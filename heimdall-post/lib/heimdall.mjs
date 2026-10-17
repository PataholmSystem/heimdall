import { createHash, randomBytes } from 'node:crypto'
import { closeSync, mkdirSync, openSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { heimdallNyckel, läsHemlighet, läsJson, raderaHemlighet, sparaJson } from './hemligheter.mjs'
import { katalog, läsInstallningar } from './installningar.mjs'

/**
 * Heimdalls API. Hjälparen loggar in i webbläsaren – Logga in, välj företag,
 * Godkänn – och svaret kommer tillbaka till en port på den egna datorn
 * (OAuth med PKCE och loopback). Utan webbläsare finns enhetsflödet kvar.
 *
 * Token gäller både MCP-servern, som hjälparen för vidare till Claude, och
 * /api/post för mejlkorgen. Den ligger i nyckelringen tillsammans med
 * utfärdaren, och varje anrop går dit token kom ifrån.
 */

export const KLIENT = 'heimdall-post'
const BEHÖRIGHETER = 'listor:las listor:skriv utkast post'

const vänta = (ms) => new Promise((r) => setTimeout(r, ms))
const formulär = (data) => new URLSearchParams(data).toString()

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

export async function metadata(issuer) {
  const svar = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/oauth-authorization-server`)
  if (!svar.ok) throw new HeimdallFel(`Heimdall svarar inte (${svar.status}).`, svar.status)
  return json(svar)
}

function läsToken() {
  const issuer = läsInstallningar().issuer
  const token = läsJson(heimdallNyckel(issuer))
  if (token) return token
  // Inloggningar från första versionen låg under ett namn utan adress.
  const gammal = läsJson('heimdall-token')
  return gammal?.issuer === issuer ? gammal : null
}

function sparaToken(token) {
  sparaJson(heimdallNyckel(token.issuer), token)
}

function tokenUr(issuer, d) {
  return { issuer, access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + d.expires_in * 1000 }
}

export function inloggad() {
  return läsToken()
}

/**
 * Inloggningen i webbläsaren. Ger adressen att skicka webbläsaren till, och en
 * funktion som byter koden som kommer tillbaka mot en token.
 */
export async function påbörjaWebbinloggning(issuer, redirectUri) {
  const m = await metadata(issuer)
  const verifierare = randomBytes(32).toString('base64url')
  const state = randomBytes(16).toString('base64url')
  const url = new URL(m.authorization_endpoint)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: KLIENT,
    redirect_uri: redirectUri,
    code_challenge: createHash('sha256').update(verifierare).digest('base64url'),
    code_challenge_method: 'S256',
    state,
    scope: BEHÖRIGHETER,
  }).toString()
  return {
    url: url.toString(),
    state,
    async avsluta(kod) {
      const svar = await fetch(m.token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: formulär({ grant_type: 'authorization_code', code: kod, client_id: KLIENT, redirect_uri: redirectUri, code_verifier: verifierare }),
      })
      const d = await json(svar)
      if (!svar.ok) throw new HeimdallFel(d.error_description || 'Inloggningen misslyckades.', svar.status)
      const token = tokenUr(m.issuer, d)
      sparaToken(token)
      return token
    },
  }
}

/** Enhetsflödet, för en dator utan webbläsare: en kod att skriva in på /koppla. */
export async function påbörjaInloggning(issuer) {
  const m = await metadata(issuer)
  const svar = await fetch(m.device_authorization_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formulär({ client_id: KLIENT, scope: BEHÖRIGHETER }),
  })
  const e = await json(svar)
  if (!svar.ok) throw new HeimdallFel(e.error_description || 'Inloggningen gick inte att starta.', svar.status)
  return {
    kod: e.user_code,
    adress: e.verification_uri,
    adressMedKod: e.verification_uri_complete,
    async väntaPåSvar() {
      let intervall = (e.interval ?? 5) * 1000
      const slut = Date.now() + (e.expires_in ?? 900) * 1000
      while (Date.now() < slut) {
        await vänta(intervall)
        const t = await fetch(m.token_endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: formulär({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: e.device_code, client_id: KLIENT }),
        })
        const d = await json(t)
        if (t.ok) {
          const token = tokenUr(m.issuer, d)
          sparaToken(token)
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
    },
  }
}

export async function loggaUt() {
  const token = läsToken()
  if (!token) return
  raderaHemlighet(heimdallNyckel(token.issuer))
  if (läsHemlighet('heimdall-token')) raderaHemlighet('heimdall-token')
  try {
    const m = await metadata(token.issuer)
    await fetch(m.revocation_endpoint, {
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
 * och använder två processer samma – Claude har hjälparen igång medan guiden
 * körs – drar Heimdall in hela kopplingen.
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

async function förnya(gammal) {
  return medLås(async () => {
    const nu = läsToken()
    if (nu && nu.refresh_token !== gammal.refresh_token && nu.expires_at > Date.now() + 60_000) return nu
    const m = await metadata(gammal.issuer)
    const svar = await fetch(m.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formulär({ grant_type: 'refresh_token', refresh_token: gammal.refresh_token, client_id: KLIENT }),
    })
    const d = await json(svar)
    if (!svar.ok) {
      raderaHemlighet(heimdallNyckel(gammal.issuer))
      throw new HeimdallFel('Inloggningen mot Heimdall har gått ut. Logga in igen.', 401)
    }
    const token = tokenUr(gammal.issuer, d)
    sparaToken(token)
    return token
  })
}

/** Ett anrop till Heimdall med token, förnyad vid behov och en gång till vid 401. */
export async function anropa(metod, sökväg, body, huvuden = {}) {
  let token = läsToken()
  if (!token) throw new HeimdallFel('Inte inloggad mot Heimdall.', 401)
  if (token.expires_at < Date.now() + 60_000) token = await förnya(token)
  for (let försök = 0; försök < 2; försök++) {
    const svar = await fetch(`${token.issuer}${sökväg}`, {
      method: metod,
      headers: { authorization: `Bearer ${token.access_token}`, ...(body ? { 'content-type': 'application/json' } : {}), ...huvuden },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (svar.status === 401 && försök === 0) {
      token = await förnya(token)
      continue
    }
    const d = await json(svar)
    if (!svar.ok) throw new HeimdallFel(d.message || d.statusMessage || `Heimdall svarade ${svar.status}.`, svar.status)
    return d
  }
  throw new HeimdallFel('Heimdall godtar inte inloggningen. Logga in igen.', 401)
}

let rpcId = 0

/**
 * Ett anrop till Heimdalls MCP-server – samma verktyg som en AI-klient når på
 * /mcp, här vidarebefordrade så att en installation räcker. Servern är
 * tillståndslös och tar ett anrop i taget.
 */
export async function mcpAnrop(method, params = {}) {
  const svar = await anropa('POST', '/mcp', { jsonrpc: '2.0', id: ++rpcId, method, params }, {
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': '2025-11-25',
  })
  if (svar.error) throw new HeimdallFel(svar.error.message || 'Heimdall svarade med ett fel.')
  return svar.result
}
