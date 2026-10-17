import { createHash } from 'node:crypto'
import { adresser, doman } from './mejl.mjs'

/**
 * Att känna igen säljarens prospekt i mejlkorgen. Allt här är rent och körs
 * på användarens dator: Heimdall ger adresserna som hashar med ett salt, och
 * hjälparen hashar det den ser i korgen på samma sätt. Det som inte matchar
 * lämnar aldrig datorn. Testas i test/match.test.mjs.
 */

export function hash(salt, adress) {
  return createHash('sha256').update(salt + String(adress).trim().toLowerCase()).digest('hex')
}

/** Koden ur en loggadress, eller null. */
export function loggkod(adress, loggDoman) {
  const m = /^logg-([a-z0-9]{8,40})(?:\+[^@]*)?@(.+)$/.exec(String(adress ?? '').trim().toLowerCase())
  return m && m[2] === loggDoman ? m[1] : null
}

/** Uppslagstabeller ur det GET /api/post/matchning gav. */
export function index(data) {
  return {
    salt: data.salt,
    loggDoman: data.loggDoman,
    hashar: new Set(data.adresser.map((a) => a.hash)),
    domaner: new Set(data.domaner.map((d) => d.doman)),
    kandaId: new Set(data.messageIds.map((m) => m.messageId)),
    vantande: data.vantande,
  }
}

/**
 * Ett skickat mejl: till ett av säljarens prospekt? Loggkoden i Bcc pekar ut
 * utkastet exakt; annars mottagarnas adresser, annars deras domän. Null när
 * mejlet inte rör listorna.
 */
export function skickat(m, ix) {
  const loggKod = adresser(m.bcc).map((a) => loggkod(a, ix.loggDoman)).find(Boolean)
  const mottagare = [...adresser(m.to), ...adresser(m.cc)].filter((a) => !loggkod(a, ix.loggDoman))
  const till = mottagare.map((a) => hash(ix.salt, a)).filter((h) => ix.hashar.has(h))
  const träffDoman = mottagare.map(doman).find((d) => ix.domaner.has(d))
  const känt = m.messageId && ix.kandaId.has(m.messageId)
  if (!loggKod && !till.length && !träffDoman && !känt) return null
  return {
    typ: 'skickat',
    messageId: m.messageId || undefined,
    inReplyTo: m.inReplyTo || undefined,
    references: m.references?.length ? m.references.slice(0, 50) : undefined,
    datum: m.datum,
    amne: (m.amne ?? '').slice(0, 300),
    till,
    doman: träffDoman || undefined,
    loggKod: loggKod || undefined,
  }
}

const SYSTEMAVSANDARE = /^(mailer-daemon|postmaster|mail-daemon|bounce|bounces)@/i

/**
 * Ett mejl i inkorgen: ett svar från ett prospekt? På tråden först – In-Reply-To
 * eller References mot det som skickats – sedan avsändarens adress, sedan
 * domänen. Autosvar och studsar räknas inte som svar.
 */
export function svar(m, ix, egna = new Set()) {
  const fran = adresser(m.from)[0]
  if (!fran || egna.has(fran) || SYSTEMAVSANDARE.test(fran)) return null
  if (/auto-(replied|generated)/i.test(m.autoSubmitted ?? '')) return null
  const iTråd = [m.inReplyTo, ...(m.references ?? [])].some((id) => id && ix.kandaId.has(id))
  const h = hash(ix.salt, fran)
  const d = doman(fran)
  if (!iTråd && !ix.hashar.has(h) && !ix.domaner.has(d)) return null
  return {
    typ: 'svar',
    messageId: m.messageId || undefined,
    inReplyTo: m.inReplyTo || undefined,
    references: m.references?.length ? m.references.slice(0, 50) : undefined,
    datum: m.datum,
    amne: (m.amne ?? '').slice(0, 300),
    fran: h,
    franDoman: d,
  }
}

/** Ser det ut som en studs? Avsändaren avgör; källtexten läses bara då. */
export function ärStuds(m) {
  const fran = adresser(m.from)[0] ?? ''
  return SYSTEMAVSANDARE.test(fran) || /^(undeliverable|undelivered|delivery status notification|olevererbart|returned mail)/i.test(m.amne ?? '')
}

/** En studs: vilket av våra mejl kom tillbaka? Letar efter kända Message-ID i källtexten. */
export function studs(m, källa, ix) {
  const text = String(källa ?? '')
  const original = [...ix.kandaId].find((id) => text.includes(id))
  if (!original) return null
  return { typ: 'studs', datum: m.datum, originalMessageId: original }
}

/**
 * Utkast som försvunnit ur Utkast-mappen utan att ha skickats. Ett utkast som
 * sparats om i ett mejlprogram kan ha fått nytt Message-ID, men Bcc-raden med
 * loggkoden följer med – därför jämförs båda.
 */
export function kastade(vantande, iUtkast, skickade) {
  return vantande
    .filter(
      (v) =>
        !iUtkast.messageIds.has(v.messageId) &&
        !iUtkast.loggKoder.has(v.loggKod) &&
        !skickade.messageIds.has(v.messageId) &&
        !skickade.loggKoder.has(v.loggKod),
    )
    .map((v) => ({ typ: 'kastat', utkastId: v.utkastId }))
}
