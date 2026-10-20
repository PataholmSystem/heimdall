import { describe, expect, it } from 'vitest'
import { AUTOMATISKA_AVSANDARE, automatisk, hash, index, kastade, loggkod, lär, misslyckade, skickat, studs, svar, ärStuds } from '../lib/match.mjs'

const salt = 'saltkod'
const sedan = '2026-10-01T00:00:00.000Z'
const kontaktad = '2026-10-05T09:00:00.000Z'
const senare = '2026-10-10T00:00:00.000Z'
// Hotellet är kontaktat. Butiken kom in i listan senare och är aldrig mejlad.
// Konsulten ringdes före Heimdall-starten, som är radens gräns.
const kontaktat = (adress) => ({ hash: hash(salt, adress), ref: 'R1', sedan, kontaktad })
const data = {
  salt,
  loggDoman: 'in.naringslivscentralen.se',
  adresser: [
    kontaktat('info@hotell.se'),
    kontaktat('order@hotell.se'),
    kontaktat('faktura@hotell.se'),
    kontaktat('nyhetsbrev@hotell.se'),
    kontaktat('noreply@hotell.se'),
    { hash: hash(salt, 'info@butik.se'), ref: 'R2', sedan: senare, kontaktad: null },
    { hash: hash(salt, 'kontakt@konsult.se'), ref: 'R4', sedan: senare, kontaktad: '2026-10-03T00:00:00.000Z' },
  ],
  domaner: [],
  messageIds: [{ messageId: '<h-abc@naringslivscentralen.se>', ref: 'R1' }],
  vantande: [
    { utkastId: 'U1', messageId: '<h-u1@n>', loggKod: 'kod00001' },
    { utkastId: 'U2', messageId: '<h-u2@n>', loggKod: 'kod00002' },
    { utkastId: 'U3', messageId: '<h-u3@n>', loggKod: 'kod00003' },
  ],
}
const ix = index(data)
const adr = (...a) => a.map((address) => ({ address }))
const datum = '2026-10-17T10:00:00.000Z'
const iTråden = { inReplyTo: '<h-abc@naringslivscentralen.se>', references: ['<h-abc@naringslivscentralen.se>'] }

describe('index', () => {
  it('sparar gränserna per hash, och den tidigaste av dem', () => {
    expect(ix.adresser.get(hash(salt, 'info@hotell.se'))).toEqual({ sedan: Date.parse(sedan), kontaktad: Date.parse(kontaktad) })
    expect(ix.adresser.get(hash(salt, 'info@butik.se'))).toEqual({ sedan: Date.parse(senare), kontaktad: null })
    expect(ix.tidigast).toBe(Date.parse(sedan))
  })

  it('samma adress på två rader släpper igenom mest, och en adress utan gräns känns aldrig igen', () => {
    const h = hash(salt, 'info@hotell.se')
    const i = index({
      ...data,
      adresser: [
        { hash: h, ref: 'R1', sedan: '2026-10-03T00:00:00.000Z', kontaktad: null },
        { hash: h, ref: 'R3', sedan: '2026-10-02T00:00:00.000Z', kontaktad: '2026-10-04T00:00:00.000Z' },
        { hash: hash(salt, 'info@butik.se'), ref: 'R2' },
      ],
    })
    expect(i.adresser.get(h)).toEqual({ sedan: Date.parse('2026-10-02T00:00:00.000Z'), kontaktad: Date.parse('2026-10-04T00:00:00.000Z') })
    expect(i.adresser.has(hash(salt, 'info@butik.se'))).toBe(false)
    expect(skickat({ to: adr('info@butik.se'), datum, amne: 'Hej' }, i)).toBeNull()
  })
})

describe('skickat', () => {
  it('hittar utkastet på loggkoden i Bcc', () => {
    const h = skickat({ to: adr('info@hotell.se'), bcc: adr('logg-kod00001@in.naringslivscentralen.se'), messageId: '<x@y>', datum, amne: 'Hej' }, ix)
    expect(h).toMatchObject({ typ: 'skickat', loggKod: 'kod00001', till: [hash(salt, 'info@hotell.se')] })
  })

  it('räknas när Heimdall känner mejlets eget Message-ID', () => {
    expect(skickat({ to: adr('anna@hotell.se'), messageId: '<h-abc@naringslivscentralen.se>', datum, amne: 'Hej' }, ix)).toMatchObject({ typ: 'skickat', till: [] })
  })

  it('räknas som uppföljning i Heimdalls tråd, också till en ny adress hos prospektet', () => {
    const h = skickat({ to: adr('anna@hotell.se'), ...iTråden, datum, amne: 'Sv: Hej' }, ix)
    expect(h).toMatchObject({ typ: 'skickat', till: [], inReplyTo: '<h-abc@naringslivscentralen.se>' })
    expect(JSON.stringify(h)).not.toContain('anna@')
  })

  it('domänen ensam räcker aldrig', () => {
    expect(skickat({ to: adr('anna@hotell.se'), datum, amne: 'Middag på lördag' }, ix)).toBeNull()
    expect(skickat({ to: adr('info@hotell.se'), datum, amne: 'Hej' }, ix)).not.toHaveProperty('doman')
  })

  it('till en känd adress räknas från att raden kom in i listan, inte före', () => {
    expect(skickat({ to: adr('info@butik.se'), datum, amne: 'Hej' }, ix)).toMatchObject({ till: [hash(salt, 'info@butik.se')] })
    expect(skickat({ to: adr('info@butik.se'), datum: '2026-10-09T23:59:00.000Z', amne: 'Retur av order 123' }, ix)).toBeNull()
  })

  it('ett svar i en tråd Heimdall inte känner räknas bara när raden redan kontaktats', () => {
    const order = { inReplyTo: '<order-123@butik.se>', references: ['<order-123@butik.se>'] }
    expect(skickat({ to: adr('info@butik.se'), ...order, datum, amne: 'Sv: Din order' }, ix)).toBeNull()
    expect(skickat({ to: adr('info@hotell.se'), ...order, datum: '2026-10-04T10:00:00.000Z', amne: 'Sv: Bokning' }, ix)).toBeNull()
    expect(skickat({ to: adr('info@hotell.se'), ...order, datum, amne: 'Sv: Bokning' }, ix)).toMatchObject({ till: [hash(salt, 'info@hotell.se')] })
  })

  it('aldrig utan läsbart datum', () => {
    expect(skickat({ to: adr('info@hotell.se'), bcc: adr('logg-kod00001@in.naringslivscentralen.se'), datum: null, amne: 'Hej' }, ix)).toBeNull()
  })

  it('bryr sig inte om mejl utanför listorna', () => {
    expect(skickat({ to: adr('vän@gmail.com'), datum, amne: 'Middag' }, ix)).toBeNull()
  })
})

describe('svar', () => {
  it('ett svar i tråden räknas, ett eget mejl och ett autosvar inte', () => {
    expect(svar({ from: adr('ny@annan.se'), ...iTråden, datum }, ix)).toMatchObject({ typ: 'svar' })
    expect(svar({ from: adr('jag@saljaren.se'), references: [], datum }, ix, new Set(['jag@saljaren.se']))).toBeNull()
    expect(svar({ from: adr('info@hotell.se'), references: [], autoSubmitted: 'auto-replied', datum }, ix)).toBeNull()
  })

  it('från en känd adress utanför tråden bara efter första kontakten', () => {
    expect(svar({ from: adr('info@hotell.se'), references: [], datum, amne: 'Ang. ert mejl' }, ix)).toMatchObject({ typ: 'svar', fran: hash(salt, 'info@hotell.se') })
    expect(svar({ from: adr('info@hotell.se'), references: [], datum: '2026-10-04T10:00:00.000Z', amne: 'Bokningsbekräftelse' }, ix)).toBeNull()
  })

  it('från en känd adress räknas inte från tiden innan raden kom in i listan, också om den kontaktats', () => {
    expect(svar({ from: adr('kontakt@konsult.se'), references: [], datum: '2026-10-05T10:00:00.000Z', amne: 'Lunch?' }, ix)).toBeNull()
    expect(svar({ from: adr('kontakt@konsult.se'), references: [], datum, amne: 'Ang. samtalet' }, ix)).toMatchObject({ typ: 'svar' })
  })

  it('från en känd adress som aldrig kontaktats räknas inte – ordern från butiken', () => {
    expect(svar({ from: adr('info@butik.se'), references: [], datum, amne: 'Din order är skickad' }, ix)).toBeNull()
  })

  it('domänen ensam räcker aldrig', () => {
    expect(svar({ from: adr('anna@hotell.se'), references: [], datum, amne: 'Ses på lördag?' }, ix)).toBeNull()
  })

  it('inget från tiden innan raden kom in i listan – en privat tråd från 2022', () => {
    expect(svar({ from: adr('info@hotell.se'), inReplyTo: '<privat@gmail.com>', references: [], datum: '2022-06-01T10:00:00.000Z', amne: 'Midsommar' }, ix)).toBeNull()
  })

  it('aldrig från noreply@, order@, faktura@ och nyhetsbrev@ – inte heller i tråden', () => {
    for (const fran of ['order@hotell.se', 'faktura@hotell.se', 'nyhetsbrev+vecka42@hotell.se', 'NoReply@hotell.se']) {
      expect(svar({ from: adr(fran), references: [], datum, amne: 'Faktura 1234' }, ix)).toBeNull()
      expect(svar({ from: adr(fran), ...iTråden, datum, amne: 'Sv: Hej' }, ix)).toBeNull()
    }
    expect(automatisk('anna@hotell.se')).toBe(false)
    expect(automatisk('info@hotell.se')).toBe(false)
    for (const lokal of ['noreply', 'no-reply', 'donotreply', 'faktura', 'invoice', 'order', 'kvitto', 'nyhetsbrev', 'newsletter', 'notifications', 'billing']) {
      expect(AUTOMATISKA_AVSANDARE.has(lokal)).toBe(true)
    }
  })

  it('aldrig ett utskick: List-Unsubscribe, List-Id eller Precedence bulk/list', () => {
    const från = { from: adr('info@hotell.se'), ...iTråden, datum, amne: 'Höstens erbjudanden' }
    expect(svar({ ...från, listUnsubscribe: '<https://hotell.se/avregistrera>' }, ix)).toBeNull()
    expect(svar({ ...från, listId: 'Nyheter <nyheter.hotell.se>' }, ix)).toBeNull()
    expect(svar({ ...från, precedence: 'bulk' }, ix)).toBeNull()
    expect(svar({ ...från, precedence: 'List' }, ix)).toBeNull()
    expect(svar({ ...från, precedence: 'first-class' }, ix)).toMatchObject({ typ: 'svar' })
  })

  it('aldrig utan läsbart datum', () => {
    expect(svar({ from: adr('info@hotell.se'), ...iTråden, datum: null }, ix)).toBeNull()
  })
})

describe('första synken och en ny UIDVALIDITY', () => {
  // SEARCH SINCE går på INTERNALDATE: flyttad eller importerad post från 2022 kommer med. Mejlets eget datum avgör.
  const gammalt = '2022-03-14T08:00:00.000Z'

  it('inget före den tidigaste gränsen lämnar datorn, inte heller i Heimdalls tråd', () => {
    expect(skickat({ to: adr('anna@hotell.se'), ...iTråden, datum: gammalt, amne: 'Sv: Hej' }, ix)).toBeNull()
    expect(skickat({ to: adr('info@hotell.se'), bcc: adr('logg-kod00001@in.naringslivscentralen.se'), datum: gammalt, amne: 'Hej' }, ix)).toBeNull()
    expect(svar({ from: adr('info@hotell.se'), ...iTråden, datum: gammalt, amne: 'Sv: Hej' }, ix)).toBeNull()
    expect(studs({ from: adr('mailer-daemon@mx.hotell.se'), amne: 'Undelivered Mail', datum: gammalt }, '<h-abc@naringslivscentralen.se>', ix)).toBeNull()
  })
})

describe('inom samma synk', () => {
  it('ett svar på ett mejl som skickats sedan förra synken räknas, som i Heimdall', () => {
    const i = index(data)
    const ut = skickat({ to: adr('info@butik.se'), messageId: '<ny-1@saljaren.se>', datum: '2026-10-16T08:00:00.000Z', amne: 'Hej' }, i)
    const tillbaka = { from: adr('info@butik.se'), inReplyTo: '<ny-1@saljaren.se>', references: ['<ny-1@saljaren.se>'], datum, amne: 'Sv: Hej' }
    expect(svar(tillbaka, i)).toBeNull()
    lär(i, ut)
    expect(svar(tillbaka, i)).toMatchObject({ typ: 'svar' })
    expect(svar({ ...tillbaka, inReplyTo: null, references: [] }, i)).toMatchObject({ typ: 'svar' })
    expect(svar({ ...tillbaka, inReplyTo: null, references: [], datum: '2026-10-16T07:00:00.000Z' }, i)).toBeNull()
  })
})

describe('studsar', () => {
  it('en studs hittar sitt original i källtexten', () => {
    const m = { from: adr('MAILER-DAEMON@mx.hotell.se'), amne: 'Undelivered Mail', datum }
    expect(ärStuds(m)).toBe(true)
    expect(studs(m, 'Original-Message-ID: <h-abc@naringslivscentralen.se>', ix)).toMatchObject({ originalMessageId: '<h-abc@naringslivscentralen.se>' })
  })

  // Så som Proton skickar den: rapporten, och originalet med Message-ID.
  const rapport = (mottagare, action = 'failed') =>
    [
      'This is the mail system at Proton Mail.',
      '',
      `<${mottagare}>: Host or domain name not found.`,
      '',
      'Reporting-MTA: dns; mail-244104.protonmail.ch',
      'Arrival-Date: Tue, 20 Oct 2026 06:12:08 +0000 (UTC)',
      '',
      `Final-Recipient: rfc822; ${mottagare}`,
      `Original-Recipient: rfc822;${mottagare}`,
      `Action: ${action}`,
      'Status: 5.4.4',
      'Diagnostic-Code: X-Postfix; Host or domain name not found. Name service error',
      '    for name=in.naringslivscentralen.se type=A: Host not found',
      '',
      'Return-Path: <saljare@foretag.se>',
      'To: info@hotell.se',
      'Bcc: logg-abcdefgh2345@in.naringslivscentralen.se',
      'Message-ID: <h-abc@naringslivscentralen.se>',
    ].join('\r\n')
  const m = { from: adr('MAILER-DAEMON@proton.me'), amne: 'Undelivered Mail Returned to Sender', datum }

  it('en studs på loggadressen i Bcc är ingen studs från prospektet', () => {
    expect(studs(m, rapport('logg-abcdefgh2345@in.naringslivscentralen.se'), ix)).toBeNull()
  })

  it('en studs från prospektet säger vilken adress som inte gick fram', () => {
    expect(studs(m, rapport('Info@Hotell.se'), ix)).toEqual({
      typ: 'studs',
      datum,
      originalMessageId: '<h-abc@naringslivscentralen.se>',
      till: hash(salt, 'info@hotell.se'),
    })
  })

  it('en försening, en egen adress eller en okänd mottagare är ingen studs', () => {
    expect(studs(m, rapport('info@hotell.se', 'delayed'), ix)).toBeNull()
    expect(studs(m, rapport('saljare@foretag.se'), ix, new Set(['saljare@foretag.se']))).toBeNull()
    expect(studs(m, rapport('nagon@annan.se'), ix)).toBeNull()
  })

  it('flera mottagare: bara de som misslyckades räknas', () => {
    const två = rapport('info@hotell.se', 'delivered').replace(
      'Final-Recipient',
      'Final-Recipient: rfc822; logg-abcdefgh2345@in.naringslivscentralen.se\r\nAction: failed\r\n\r\nFinal-Recipient',
    )
    expect(misslyckade(två)).toEqual(['logg-abcdefgh2345@in.naringslivscentralen.se'])
    expect(studs(m, två, ix)).toBeNull()
  })
})

describe('kastade utkast', () => {
  it('ett omsparat utkast med samma Bcc är inte kastat, ett skickat inte heller', () => {
    const k = kastade(
      ix.vantande,
      { messageIds: new Set(['<h-u1@n>']), loggKoder: new Set(['kod00002']) },
      { messageIds: new Set(), loggKoder: new Set() },
    )
    expect(k).toEqual([{ typ: 'kastat', utkastId: 'U3' }])
  })

  it('läser koden ur loggadressen', () => {
    expect(loggkod('LOGG-kod00001@IN.naringslivscentralen.se', 'in.naringslivscentralen.se')).toBe('kod00001')
    expect(loggkod('logg-kod00001@annan.se', 'in.naringslivscentralen.se')).toBeNull()
  })
})
