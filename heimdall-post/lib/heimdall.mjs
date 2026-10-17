import { closeSync, mkdirSync, openSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { läsJson, raderaHemlighet, sparaJson } from './hemligheter.mjs'
import { katalog } from './installningar.mjs'

/**
 * Heimdalls API, inloggat med OAuth:s enhetsflöde (RFC 8628): hjälparen visar
 * en kod, användaren skriver in den på naringslivscentralen.se/koppla, och
 * hjälparen får en token som bara gäller /api/post. Token och förnyelsetoken
 * ligger i nyckelringen tillsammans med utfärdaren, och varje anrop går till
 * den utfärdare token kom ifrån – en utvecklingskörning kan alltså inte skriva
 * i produktionen av misstag.
 */

export const KLIENT = 'heimdall-post'
const NYCKEL = 'heimdall-token'

const vänta = (ms) => new Promise((r) => setTimeout(r, ms))

export class HeimdallFel extends Error {
  constructor(text, status = 0) {
    super(text)
    this.status = status
  }
}

async function json(svar) {
  const text = await svar.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { message: text.slice(0, 200) }
  }
}

export async function metadata(issuer, f = fetch) {
  const svar = await f(`${issuer.replace(/\/$/, '')}/.well-known/oauth-authorization-server`)
  if (!svar.ok) throw new HeimdallFel(`Heimdall svarar inte på ${issuer} (${svar.status}).`, svar.status)
  return json(svar)
}

const formulär = (data) => new URLSearchParams(data).toString()

/** Startar enhetsflödet. Ger koden att visa, och en funktion som väntar på svaret. */
export async function påbörjaInloggning(issuer, f = fetch) {
  const m = await metadata(issuer, f)
  const svar = await f(m.device_authorization_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formulär({ client_id: KLIENT, scope: 'post' }),
  })
  const e = await json(svar)
  if (!svar.ok) throw new HeimdallFel(e.error_description || 'Inloggningen gick inte att starta.', svar.status)

  async function vänta_på_svar({ avbryt } = {}) {
    let intervall = (e.interval ?? 5) * 1000
    const slut = Date.now() + (e.expires_in ?? 900) * 1000
    while (Date.now() < slut) {
      await vänta(intervall)
      if (avbryt?.()) throw new HeimdallFel('Inloggningen avbröts.')
      const t = await f(m.token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: formulär({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: e.device_code, client_id: KLIENT }),
      })
      const d = await json(t)
      if (t.ok) {
        const token = { issuer: m.issuer, access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + d.expires_in * 1000 }
        sparaJson(NYCKEL, token)
        return token
      }
      if (d.error === 'authorization_pending') continue
      if (d.error === 'slow_down') {
        intervall += 5000
        continue
      }
      throw new HeimdallFel(d.error === 'access_denied' ? 'Kopplingen nekades i webbläsaren.' : d.error_description || 'Inloggningen misslyckades.')
    }
    throw new HeimdallFel('Koden gick ut. Försök igen.')
  }

  return { kod: e.user_code, adress: e.verification_uri, adressMedKod: e.verification_uri_complete, väntaPåSvar: vänta_på_svar }
}

export function inloggad() {
  return läsJson(NYCKEL)
}

export async function loggaUt(f = fetch) {
  const token = läsJson(NYCKEL)
  raderaHemlighet(NYCKEL)
  if (!token) return
  try {
    const m = await metadata(token.issuer, f)
    await f(m.revocation_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formulär({ token: token.refresh_token, client_id: KLIENT }),
    })
  } catch {
    // Token är borta lokalt; servern drar in den när den går ut.
  }
}

/**
 * Ett lås medan token förnyas. Förnyelsetoken går bara att använda en gång,
 * och använder två processer samma – Claude Code har hjälparen igång medan
 * någon kör `heimdall-post status` – drar Heimdall in hela kopplingen.
 */
async function medLås(kör) {
  mkdirSync(katalog(), { recursive: true, mode: 0o700 })
  const väg = join(katalog(), 'token.lock')
  for (let försök = 0; ; försök++) {
    try {
      const fd = openSync(väg, 'wx')
      try {
        return await kör()
      } finally {
        closeSync(fd)
        unlinkSync(väg)
      }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      // Ett lås som legat kvar i en halv minut är efter en process som dog.
      try {
        if (Date.now() - statSync(väg).mtimeMs > 30_000) unlinkSync(väg)
      } catch {
        // Försvann under tiden.
      }
      if (försök > 100) throw new HeimdallFel('Kunde inte förnya inloggningen: låset blev aldrig ledigt.')
      await vänta(200)
    }
  }
}

async function förnya(gammal, f) {
  return medLås(async () => {
    // En annan process kan ha förnyat medan vi väntade på låset.
    const nu = läsJson(NYCKEL)
    if (nu && nu.refresh_token !== gammal.refresh_token && nu.expires_at > Date.now() + 60_000) return nu
    const m = await metadata(gammal.issuer, f)
    const svar = await f(m.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formulär({ grant_type: 'refresh_token', refresh_token: gammal.refresh_token, client_id: KLIENT }),
    })
    const d = await json(svar)
    if (!svar.ok) {
      raderaHemlighet(NYCKEL)
      throw new HeimdallFel('Inloggningen mot Heimdall har gått ut. Kör `npx heimdall-post setup` igen.', 401)
    }
    const token = { issuer: gammal.issuer, access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + d.expires_in * 1000 }
    sparaJson(NYCKEL, token)
    return token
  })
}

/** Ett anrop till Heimdall med token, förnyad vid behov och en gång till vid 401. */
export async function anropa(metod, sökväg, body, f = fetch) {
  let token = läsJson(NYCKEL)
  if (!token) throw new HeimdallFel('Hjälparen är inte inloggad mot Heimdall. Kör `npx heimdall-post setup`.', 401)
  if (token.expires_at < Date.now() + 60_000) token = await förnya(token, f)
  for (let försök = 0; försök < 2; försök++) {
    const svar = await f(`${token.issuer}${sökväg}`, {
      method: metod,
      headers: { authorization: `Bearer ${token.access_token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (svar.status === 401 && försök === 0) {
      token = await förnya(token, f)
      continue
    }
    const d = await json(svar)
    if (!svar.ok) throw new HeimdallFel(d.message || d.statusMessage || `Heimdall svarade ${svar.status}.`, svar.status)
    return d
  }
  throw new HeimdallFel('Heimdall godtar inte inloggningen. Kör `npx heimdall-post setup` igen.', 401)
}
