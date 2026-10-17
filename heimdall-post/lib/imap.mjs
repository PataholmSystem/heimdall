import { X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { FORVAL } from './forval.mjs'
import { läsHemlighet } from './hemligheter.mjs'
import { referenser, rubrik } from './mejl.mjs'
import { microsoftToken } from './microsoft.mjs'

/**
 * IMAP mot användarens egen korg. Bara det hjälparen behöver: hitta mapparna,
 * lägga ett utkast, läsa rubriker – och läsa en hel källtext bara för studsar,
 * svar användaren bett om och de egna mejlen till tonen.
 *
 * TLS kontrolleras alltid. Proton Bridge har ett självsignerat certifikat; det
 * exporteras ur Bridge vid installationen och fästs här, så att bara just den
 * Bridge godtas.
 */

const RUBRIKER = ['references', 'auto-submitted', 'x-heimdall-utkast']

export async function anslut(inst) {
  const imap = inst.imap ?? {}
  const förval = FORVAL[imap.forval] ?? FORVAL.annan
  const host = imap.host || förval.host
  const port = imap.port || förval.port
  const secure = imap.secure ?? förval.secure
  if (!host || !imap.anvandare) throw new Error('Mejlkorgen är inte inställd. Kör `npx heimdall-post setup`.')

  const auth =
    (imap.auth ?? förval.auth) === 'microsoft'
      ? { user: imap.anvandare, accessToken: await microsoftToken() }
      : { user: imap.anvandare, pass: process.env.HEIMDALL_POST_IMAP_PASSWORD || läsHemlighet('imap-losenord') }
  if (!auth.accessToken && !auth.pass) throw new Error('Lösenordet till mejlkorgen saknas. Kör `npx heimdall-post setup`.')

  let tls = { minVersion: 'TLSv1.2' }
  if (förval.bridge || imap.bridgeCert) {
    if (!imap.bridgeCert) throw new Error('Bridges certifikat saknas. Exportera det ur Proton Mail Bridge och kör setup igen.')
    const pem = readFileSync(imap.bridgeCert)
    const fäst = new X509Certificate(pem).fingerprint256
    tls = {
      ...tls,
      ca: [pem],
      // Bridges certifikat är utfärdat till sig självt. Det som räknas är att
      // det är exakt det certifikat användaren exporterade.
      checkServerIdentity: (_värd, cert) =>
        cert.fingerprint256 === fäst ? undefined : new Error('Bridge svarade med ett annat certifikat än det som exporterades.'),
    }
  }
  const klient = new ImapFlow({ host, port, secure, doSTARTTLS: secure ? undefined : true, auth, tls, logger: false, emitLogs: false })
  await klient.connect()
  return klient
}

const NAMN = {
  '\\Drafts': ['drafts', 'utkast', '[gmail]/drafts', '[gmail]/utkast', 'inbox.drafts', 'draft'],
  '\\Sent': ['sent', 'skickat', 'skickade', 'sent items', 'sent messages', 'skickade objekt', '[gmail]/sent mail', '[gmail]/skickat', 'inbox.sent'],
}

/** Utkast, Skickat och Inkorg – på SPECIAL-USE, och på namnen som reserv. */
export async function mappar(klient) {
  const lista = await klient.list()
  const hitta = (roll) =>
    lista.find((m) => m.specialUse === roll)?.path ?? lista.find((m) => NAMN[roll]?.includes(m.path.toLowerCase()))?.path ?? null
  return { utkast: hitta('\\Drafts'), skickat: hitta('\\Sent'), inkorg: 'INBOX' }
}

function meddelande(msg) {
  const e = msg.envelope ?? {}
  return {
    uid: msg.uid,
    messageId: e.messageId ?? null,
    inReplyTo: e.inReplyTo ?? null,
    references: referenser(msg.headers),
    autoSubmitted: rubrik(msg.headers, 'auto-submitted'),
    heimdallUtkast: rubrik(msg.headers, 'x-heimdall-utkast'),
    datum: (e.date instanceof Date && !Number.isNaN(e.date.getTime()) ? e.date : new Date()).toISOString(),
    amne: e.subject ?? '',
    from: e.from,
    to: e.to,
    cc: e.cc,
    bcc: e.bcc,
  }
}

/**
 * Rubrikerna i en mapp, efter vattenmärket eller sedan ett datum. `vad` är
 * antingen det, eller en funktion som får mappens UIDVALIDITY och bestämmer –
 * ett vattenmärke gäller bara så länge den inte bytts. Ger också UIDVALIDITY
 * och högsta UID, så att vattenmärket kan flyttas.
 */
export async function läsRubriker(klient, mapp, vadFör, max = 2000) {
  const lås = await klient.getMailboxLock(mapp, { readOnly: true })
  try {
    const uidValidity = String(klient.mailbox.uidValidity)
    const vad = typeof vadFör === 'function' ? vadFör(uidValidity) : vadFör
    let uids = vad.uidFrån
      ? await klient.search({ uid: `${vad.uidFrån}:*` }, { uid: true })
      : await klient.search({ since: vad.sedan }, { uid: true })
    // "n:*" ger alltid minst det sista meddelandet, också när det är äldre än n.
    if (vad.uidFrån) uids = (uids || []).filter((u) => u >= vad.uidFrån)
    uids = (uids || []).sort((a, b) => a - b).slice(-max)
    const meddelanden = []
    if (uids.length) {
      for await (const msg of klient.fetch(uids, { uid: true, envelope: true, headers: RUBRIKER }, { uid: true })) {
        meddelanden.push(meddelande(msg))
      }
    }
    const högsta = uids.length ? uids[uids.length - 1] : 0
    return { uidValidity, högstaUid: högsta, meddelanden }
  } finally {
    lås.release()
  }
}

/** Hela källtexten för några meddelanden, högst `maxByte` var. */
export async function läsKällor(klient, mapp, uids, maxByte = 300_000) {
  if (!uids.length) return new Map()
  const lås = await klient.getMailboxLock(mapp, { readOnly: true })
  try {
    const ut = new Map()
    for await (const msg of klient.fetch(uids, { uid: true, source: { maxLength: maxByte } }, { uid: true })) {
      ut.set(msg.uid, msg.source)
    }
    return ut
  } finally {
    lås.release()
  }
}

export async function textUr(källa) {
  const tolkat = await simpleParser(källa, { skipHtmlToText: false, skipImageLinks: true, skipTextLinks: true })
  return tolkat.text ?? ''
}

/** Finns ett meddelande med det här Message-ID redan i mappen? */
export async function finns(klient, mapp, messageId) {
  const lås = await klient.getMailboxLock(mapp, { readOnly: true })
  try {
    const träffar = await klient.search({ header: { 'message-id': messageId } }, { uid: true })
    return Boolean(träffar?.length)
  } finally {
    lås.release()
  }
}

export async function läggIUtkast(klient, mapp, rå) {
  await klient.append(mapp, rå, ['\\Draft', '\\Seen'])
}

/** UID för meddelanden vars Bcc innehåller en text – de egna mejlen via Heimdall. */
export async function sökBcc(klient, mapp, text, max = 20) {
  const lås = await klient.getMailboxLock(mapp, { readOnly: true })
  try {
    const träffar = (await klient.search({ header: { bcc: text } }, { uid: true })) || []
    return träffar.sort((a, b) => a - b).slice(-max)
  } finally {
    lås.release()
  }
}
