import MailComposer from 'nodemailer/lib/mail-composer'

/**
 * Att bygga och läsa mejl, utan IMAP. Testas i test/mejl.test.mjs.
 */

/** Utkastet som RFC 822, färdigt att lägga i Utkast-mappen. Ren text, UTF-8. */
export function byggUtkast(u, fran) {
  return new Promise((resolve, reject) => {
    const nod = new MailComposer({
      from: fran,
      to: u.till,
      bcc: u.bcc,
      subject: u.amne,
      text: u.text,
      messageId: u.messageId,
      inReplyTo: u.inReplyTo || undefined,
      references: u.references?.length ? u.references : undefined,
      date: new Date(),
      headers: { 'X-Heimdall-Utkast': u.id },
      textEncoding: 'quoted-printable',
    }).compile()
    // Bcc tas annars bort när mejlet byggs – för ett mejl som ska skickas är
    // det rätt. Ett utkast måste behålla den: loggkoden står där.
    nod.keepBcc = true
    nod.build((fel, rå) => (fel ? reject(fel) : resolve(rå)))
  })
}

/** Adresserna i ett adressfält ur imapflows kuvert: [{ address, name }]. */
export function adresser(fält) {
  return (fält ?? []).map((a) => String(a?.address ?? '').trim().toLowerCase()).filter((a) => a.includes('@'))
}

export function doman(adress) {
  return String(adress).split('@')[1]?.toLowerCase() ?? ''
}

/** References-rubriken ur råa rubriker: alla <…> i den. */
export function referenser(råaRubriker) {
  const text = Buffer.isBuffer(råaRubriker) ? råaRubriker.toString('utf8') : String(råaRubriker ?? '')
  const m = /^references:\s*((?:.*(?:\r?\n[ \t].*)*))/im.exec(text)
  return m ? [...m[1].matchAll(/<[^<>\s]+>/g)].map((x) => x[0]) : []
}

/** En rubrik ur råa rubriker, ihopvikt. */
export function rubrik(råaRubriker, namn) {
  const text = Buffer.isBuffer(råaRubriker) ? råaRubriker.toString('utf8') : String(råaRubriker ?? '')
  const m = new RegExp(`^${namn}:\\s*((?:.*(?:\\r?\\n[ \\t].*)*))`, 'im').exec(text)
  return m ? m[1].replace(/\r?\n[ \t]+/g, ' ').trim() : ''
}

/**
 * Svaret utan det citerade: allt efter "Den … skrev:", "On … wrote:", en
 * citerad rad eller ett vidarebefordrat original faller bort. Högst `max` tecken.
 */
export function svarstext(text, max = 2000) {
  const rader = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const slut = rader.findIndex(
    (r) =>
      /^>/.test(r) ||
      /^(Den|On|Le|Am)\s.*\b(skrev|wrote|écrit|schrieb)\b.*:\s*$/i.test(r.trim()) ||
      /^-{2,}\s*(Original Message|Ursprungligt meddelande|Ursprungligt mejl)/i.test(r.trim()) ||
      /^(Från|From):\s/.test(r.trim()),
  )
  const kvar = (slut === -1 ? rader : rader.slice(0, slut)).join('\n').trim()
  return kvar.length > max ? `${kvar.slice(0, max - 1)}…` : kvar
}

/**
 * Användarens egen text ur ett skickat mejl, till tonen: utan hälsningsraden,
 * utan sidfoten efter "-- " och utan det citerade.
 */
export function egenText(text) {
  const utanFot = String(text ?? '').replace(/\r\n/g, '\n').split(/\n-- \n/)[0]
  const rader = svarstext(utanFot, 3000).split('\n')
  if (/^(hej|hejsan|hallå|god (morgon|dag)|hello|hi)\b/i.test(rader[0]?.trim() ?? '')) rader.shift()
  return rader.join('\n').trim()
}
