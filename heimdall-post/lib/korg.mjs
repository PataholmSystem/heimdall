import { FORVAL } from './forval.mjs'
import { hämtaBridgeCert, sparaBridgeCert } from './bridge.mjs'
import { imapNyckel, sparaHemlighet } from './hemligheter.mjs'
import { anslut, mappar } from './imap.mjs'
import { läsInstallningar, sparaInstallningar } from './installningar.mjs'

/**
 * Att koppla mejlkorgen: prova, och spara först när det fungerat. Felen
 * översätts till något en människa förstår, per tjänst – ett IMAP-fel säger
 * ingenting för den som aldrig hört ordet.
 */

export class KorgFel extends Error {
  constructor(text, { tips } = {}) {
    super(text)
    this.tips = tips ?? null
  }
}

/** Ett fel från anslutningen, som en mening till användaren. Testas i test/korg.test.mjs. */
export function vänligtFel(e, forval) {
  const f = FORVAL[forval] ?? FORVAL.annan
  const kod = e?.code ?? ''
  const text = `${e?.message ?? ''} ${e?.responseText ?? ''}`
  if (e?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|authentication failed|LOGIN failed|\[AUTH/i.test(text)) {
    return new KorgFel(f.felLosenord ?? 'Lösenordet godtogs inte. Kontrollera att du klistrade in rätt lösenord.')
  }
  if (kod === 'ECONNREFUSED' && f.bridge) {
    return new KorgFel('Proton Mail Bridge är inte igång.', { tips: 'Starta Proton Mail Bridge och försök igen.' })
  }
  if (kod === 'ENOTFOUND' || kod === 'EAI_AGAIN') {
    return new KorgFel('Hittar inte mejlservern.', { tips: 'Kontrollera internetanslutningen, eller servernamnet under "Avancerat".' })
  }
  if (kod === 'ETIMEDOUT' || kod === 'ECONNRESET' || /timeout/i.test(text)) {
    return new KorgFel('Mejlservern svarar inte.', { tips: 'Försök igen om en stund. Är du på ett jobbnätverk kan det stoppa anslutningen.' })
  }
  if (/certifikat|certificate|CERT_|ERR_TLS/i.test(`${kod} ${text}`)) {
    return new KorgFel('Den säkra anslutningen till mejlservern gick inte att kontrollera.', {
      tips: f.bridge ? 'Har Proton Mail Bridge installerats om? Försök koppla igen, så hämtas det nya certifikatet.' : null,
    })
  }
  return new KorgFel('Det gick inte att ansluta till mejlkorgen.', { tips: e?.message ? `Felet: ${e.message}` : null })
}

/**
 * Kopplar korgen: hämtar Bridges certifikat när det behövs, provar
 * inloggningen och hittar mapparna, och sparar sedan lösenordet i
 * nyckelringen och resten i inställningarna.
 */
export async function kopplaKorg({ adress, losenord, forval, anvandare, host, port }) {
  const f = FORVAL[forval] ?? FORVAL.annan
  const portNr = Number(port) || f.port
  const imap = {
    forval,
    auth: f.auth,
    anvandare: (anvandare || adress).trim(),
    fran: adress.trim(),
    host: (host || f.host || '').trim(),
    port: portNr,
    secure: portNr === 993 ? true : f.secure,
  }
  if (f.bridge) {
    try {
      imap.bridgeCert = sparaBridgeCert(await hämtaBridgeCert({ host: imap.host, port: imap.port }))
    } catch (e) {
      throw vänligtFel(e, forval)
    }
  }
  const inst = läsInstallningar()
  let hittade
  try {
    const klient = await anslut({ ...inst, imap }, { losenord: f.auth === 'losenord' ? losenord : undefined })
    hittade = await mappar(klient)
    await klient.logout().catch(() => {})
  } catch (e) {
    throw vänligtFel(e, forval)
  }
  if (f.auth === 'losenord') sparaHemlighet(imapNyckel(imap.anvandare), losenord)
  sparaInstallningar({ ...inst, imap })
  return hittade
}
