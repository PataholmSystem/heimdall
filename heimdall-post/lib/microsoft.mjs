import { läsJson, microsoftNyckel, sparaJson } from './hemligheter.mjs'

/**
 * Inloggningen mot Outlook och Microsoft 365. Microsoft har stängt av lösenord
 * för IMAP, så hjälparen loggar in med en kod i webbläsaren (OAuth:s
 * enhetsflöde) och använder token mot IMAP (XOAUTH2).
 *
 * Det kräver en appregistrering i Microsoft Entra – en publik klient med
 * behörigheten IMAP.AccessAsUser.All och enhetsflödet påslaget. Klient-id:t
 * sätts i HEIMDALL_POST_MS_CLIENT_ID tills den publicerade registreringen finns.
 */
const SCOPE = 'https://outlook.office.com/IMAP.AccessAsUser.All offline_access'
const BAS = 'https://login.microsoftonline.com/common/oauth2/v2.0'

export function klientId() {
  return process.env.HEIMDALL_POST_MS_CLIENT_ID || ''
}

const formulär = (data) => new URLSearchParams(data).toString()

export async function påbörjaMicrosoft(anvandare) {
  if (!klientId()) {
    throw new Error('Microsoft-inloggningen är inte inställd än (HEIMDALL_POST_MS_CLIENT_ID saknas). Tills dess fungerar Heimdalls utkastlåda.')
  }
  const svar = await fetch(`${BAS}/devicecode`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formulär({ client_id: klientId(), scope: SCOPE }),
  })
  const d = await svar.json()
  if (!svar.ok) throw new Error(d.error_description || 'Microsoft-inloggningen gick inte att starta.')
  return {
    kod: d.user_code,
    adress: d.verification_uri,
    async väntaPåSvar() {
      let intervall = (d.interval ?? 5) * 1000
      const slut = Date.now() + (d.expires_in ?? 900) * 1000
      while (Date.now() < slut) {
        await new Promise((r) => setTimeout(r, intervall))
        const t = await fetch(`${BAS}/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: formulär({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: d.device_code, client_id: klientId() }),
        })
        const r = await t.json()
        if (t.ok) {
          const token = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Date.now() + r.expires_in * 1000 }
          sparaJson(microsoftNyckel(anvandare), token)
          return token
        }
        if (r.error === 'authorization_pending') continue
        if (r.error === 'slow_down') {
          intervall += 5000
          continue
        }
        throw new Error(r.error_description || 'Microsoft-inloggningen misslyckades.')
      }
      throw new Error('Koden gick ut. Försök igen.')
    },
  }
}

/** En giltig token för IMAP, förnyad när den är på väg att gå ut. */
export async function microsoftToken(anvandare) {
  const token = läsJson(microsoftNyckel(anvandare))
  if (!token) throw new Error('Inte inloggad mot Microsoft. Öppna guiden och logga in igen.')
  if (token.expires_at > Date.now() + 120_000) return token.access_token
  const svar = await fetch(`${BAS}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formulär({ grant_type: 'refresh_token', refresh_token: token.refresh_token, client_id: klientId(), scope: SCOPE }),
  })
  const r = await svar.json()
  if (!svar.ok) throw new Error('Microsoft-inloggningen har gått ut. Öppna guiden och logga in igen.')
  sparaJson(microsoftNyckel(anvandare), { access_token: r.access_token, refresh_token: r.refresh_token ?? token.refresh_token, expires_at: Date.now() + r.expires_in * 1000 })
  return r.access_token
}
