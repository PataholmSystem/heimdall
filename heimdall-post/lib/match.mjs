import { createHash } from 'node:crypto'
import { adresser, doman } from './mejl.mjs'

/**
 * Att känna igen säljarens prospekt i mejlkorgen. Allt här är rent och körs
 * på användarens dator: Heimdall ger adresserna som hashar med ett salt, och
 * hjälparen hashar det den ser i korgen på samma sätt. Det som inte matchar
 * lämnar aldrig datorn – inte heller ämnesraden. Testas i test/match.test.mjs.
 *
 * Reglerna är synkens i Heimdall (synkaFrånPost), så att hjälparen inte
 * skickar det som ändå inte godtas: ett mejl hör till prospektarbetet när det
 * hör till en tråd Heimdall känner, eller går till eller kommer från en adress
 * på raden – och då inte från tiden innan raden kom in i listan. Domänen ensam
 * räcker aldrig: ordrar, fakturor och privat post från samma företag kom med
 * på den.
 */

export function hash(salt, adress) {
  return createHash('sha256').update(salt + String(adress).trim().toLowerCase()).digest('hex')
}

/** Koden ur en loggadress, eller null. */
export function loggkod(adress, loggDoman) {
  const m = /^logg-([a-z0-9]{8,40})(?:\+[^@]*)?@(.+)$/.exec(String(adress ?? '').trim().toLowerCase())
  return m && m[2] === loggDoman ? m[1] : null
}

/** Tiden i millisekunder, eller null när den inte går att läsa. */
function tid(datum) {
  const t = Date.parse(datum ?? '')
  return Number.isNaN(t) ? null : t
}

const minst = (a, b) => (a === null ? b : b === null ? a : Math.min(a, b))

/**
 * Uppslagstabeller ur det GET /api/post/matchning gav. `adresser` går från
 * hash till gränserna, i millisekunder: `sedan` – inget före den känns igen på
 * adressen – och `kontaktad`, radens första kontakt ut eller null. En adress
 * utan läsbart `sedan` känns aldrig igen.
 *
 * `tidigast` är den tidigaste gränsen, och inget äldre lämnar datorn, vad det
 * än matchar. Första synken och en ny UIDVALIDITY läser efter IMAP:s SEARCH
 * SINCE, som går på när mejlet kom in i korgen och inte på dess eget datum –
 * en flytt eller import av gammal post fick då med mejl från flera år sedan.
 */
export function index(data) {
  const per = new Map()
  for (const a of data.adresser ?? []) {
    const sedan = tid(a.sedan)
    if (sedan === null) continue
    const kontaktad = tid(a.kontaktad)
    const förra = per.get(a.hash)
    // Samma adress på flera rader: det som släpper igenom mest. Heimdall prövar varje rad.
    per.set(a.hash, förra ? { sedan: Math.min(förra.sedan, sedan), kontaktad: minst(förra.kontaktad, kontaktad) } : { sedan, kontaktad })
  }
  let tidigast = null
  for (const a of per.values()) tidigast = minst(tidigast, a.sedan)
  return {
    salt: data.salt,
    loggDoman: data.loggDoman,
    adresser: per,
    tidigast,
    kandaId: new Set(data.messageIds.map((m) => m.messageId)),
    vantande: data.vantande,
  }
}

/** Mejlets tid, eller null när det inte får lämna datorn: datumet går inte att läsa eller är före `tidigast`. */
function tidFör(m, ix) {
  const t = tid(m.datum)
  return t === null || (ix.tidigast !== null && t < ix.tidigast) ? null : t
}

/** Hör mejlet till en tråd Heimdall känner – In-Reply-To eller References mot det som skickats? */
const iKändTråd = (m, ix) => [m.inReplyTo, ...(m.references ?? [])].some((id) => id && ix.kandaId.has(id))

/** Kontaktades raden bakom adressen före tidpunkten? */
const kontaktadFöre = (a, t) => a.kontaktad !== null && a.kontaktad < t

/**
 * Ett skickat mejl: till ett av säljarens prospekt? Loggkoden i Bcc pekar ut
 * utkastet exakt, och ett känt Message-ID eller en känd tråd hör till Heimdall.
 * Annars räknas en mottagare som är en känd adress, men inte från tiden innan
 * raden kom in i listan – och om mejlet svarar i en tråd Heimdall inte känner
 * (en order, en bokning) bara när raden redan är kontaktad. Null när mejlet
 * inte rör listorna.
 */
export function skickat(m, ix) {
  const t = tidFör(m, ix)
  if (t === null) return null
  const loggKod = adresser(m.bcc).map((a) => loggkod(a, ix.loggDoman)).find(Boolean)
  const känt = Boolean(m.messageId && ix.kandaId.has(m.messageId))
  const iTråd = iKändTråd(m, ix)
  const svarIOkändTråd = !iTråd && Boolean(m.inReplyTo || m.references?.length)
  const till = [...adresser(m.to), ...adresser(m.cc)]
    .filter((a) => !loggkod(a, ix.loggDoman))
    .map((a) => hash(ix.salt, a))
    .filter((h) => {
      const a = ix.adresser.get(h)
      return a && t >= a.sedan && (!svarIOkändTråd || kontaktadFöre(a, t))
    })
  if (!loggKod && !känt && !iTråd && !till.length) return null
  return {
    typ: 'skickat',
    messageId: m.messageId || undefined,
    inReplyTo: m.inReplyTo || undefined,
    references: m.references?.length ? m.references.slice(0, 50) : undefined,
    datum: m.datum,
    amne: (m.amne ?? '').slice(0, 300),
    till: [...new Set(till)],
    loggKod: loggKod || undefined,
  }
}

/**
 * Det ett skickat mejl lär resten av synken, som Heimdall gör när det som går
 * ut behandlas före det som kommer in: mejlet blir en känd tråd och
 * mottagarna kontaktade. Annars räknas inte ett svar på ett mejl som skickats
 * sedan förra synken. Ändrar `ix`.
 */
export function lär(ix, h) {
  if (h.messageId) ix.kandaId.add(h.messageId)
  const t = tid(h.datum)
  if (t === null) return
  for (const x of h.till ?? []) {
    const a = ix.adresser.get(x)
    if (a) a.kontaktad = minst(a.kontaktad, t)
  }
}

/**
 * Lokaldelar som skickar av sig själva: ordrar, fakturor, aviseringar,
 * nyhetsbrev. Samma lista som AUTOMATISKA_AVSANDARE i Heimdall
 * (shared/utskick.ts).
 */
export const AUTOMATISKA_AVSANDARE = new Set([
  'noreply', 'no-reply', 'no_reply', 'donotreply', 'do-not-reply', 'do_not_reply', 'dontreply', 'mailer-daemon',
  'postmaster', 'bounce', 'bounces', 'mailer', 'notifications', 'notification', 'notify', 'notiser', 'avisering',
  'newsletter', 'nyhetsbrev', 'news', 'nyheter', 'marketing', 'kampanj', 'erbjudanden', 'order', 'orders', 'ordrar',
  'bestallning', 'kvitto', 'receipt', 'receipts', 'invoice', 'invoices', 'faktura', 'fakturor', 'billing',
  'payment', 'payments', 'betalning', 'automated', 'system',
])

/** Skickar adressen av sig själv – noreply@, faktura@, nyhetsbrev@? En +tagg ändrar ingenting. */
export function automatisk(adress) {
  return AUTOMATISKA_AVSANDARE.has(String(adress).split('@')[0].trim().toLowerCase().replace(/\+.*$/, ''))
}

/** Ett utskick till många – nyhetsbrev, e-postlistor – och inget svar på ett mejl. */
export function massutskick(m) {
  return Boolean(m.listId || m.listUnsubscribe) || /^(bulk|list|junk)\b/i.test(String(m.precedence ?? '').trim())
}

const SYSTEMAVSANDARE = /^(mailer-daemon|postmaster|mail-daemon|bounce|bounces)@/i

/**
 * Ett mejl i inkorgen: ett svar från ett prospekt? I en tråd Heimdall känner –
 * In-Reply-To eller References mot det som skickats – eller från en känd
 * adress, och då bara när raden kontaktats före mejlet och inte från tiden
 * innan den kom in i listan. Autosvar, studsar, utskick och avsändare som
 * noreply@ och faktura@ räknas aldrig som svar, inte heller i tråden.
 */
export function svar(m, ix, egna = new Set()) {
  const fran = adresser(m.from)[0]
  if (!fran || egna.has(fran) || SYSTEMAVSANDARE.test(fran) || automatisk(fran)) return null
  if (/auto-(replied|generated)/i.test(m.autoSubmitted ?? '') || massutskick(m)) return null
  const t = tidFör(m, ix)
  if (t === null) return null
  const h = hash(ix.salt, fran)
  const a = ix.adresser.get(h)
  if (!iKändTråd(m, ix) && !(a && t >= a.sedan && kontaktadFöre(a, t))) return null
  return {
    typ: 'svar',
    messageId: m.messageId || undefined,
    inReplyTo: m.inReplyTo || undefined,
    references: m.references?.length ? m.references.slice(0, 50) : undefined,
    datum: m.datum,
    amne: (m.amne ?? '').slice(0, 300),
    fran: h,
    franDoman: doman(fran),
  }
}

/** Ser det ut som en studs? Avsändaren avgör; källtexten läses bara då. */
export function ärStuds(m) {
  const fran = adresser(m.from)[0] ?? ''
  return SYSTEMAVSANDARE.test(fran) || /^(undeliverable|undelivered|delivery status notification|olevererbart|returned mail)/i.test(m.amne ?? '')
}

/** En studs: vilket av våra mejl kom tillbaka? Letar efter kända Message-ID i källtexten. */
export function studs(m, källa, ix) {
  if (tidFör(m, ix) === null) return null
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
