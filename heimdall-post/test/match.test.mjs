import { describe, expect, it } from 'vitest'
import { hash, index, kastade, loggkod, skickat, studs, svar, ärStuds } from '../lib/match.mjs'

const salt = 'saltkod'
const data = {
  salt,
  loggDoman: 'in.naringslivscentralen.se',
  adresser: [{ hash: hash(salt, 'info@hotell.se'), ref: 'R1' }],
  domaner: [{ doman: 'hotell.se', ref: 'R1' }],
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

describe('skickat', () => {
  it('hittar utkastet på loggkoden i Bcc', () => {
    const h = skickat({ to: adr('info@hotell.se'), bcc: adr('logg-kod00001@in.naringslivscentralen.se'), messageId: '<x@y>', datum, amne: 'Hej' }, ix)
    expect(h).toMatchObject({ typ: 'skickat', loggKod: 'kod00001', till: [hash(salt, 'info@hotell.se')] })
  })

  it('känner igen mottagaren på hash och domän, men skickar aldrig adressen', () => {
    const h = skickat({ to: adr('anna@hotell.se'), datum, amne: 'Hej' }, ix)
    expect(h).toMatchObject({ doman: 'hotell.se', till: [] })
    expect(JSON.stringify(h)).not.toContain('anna@')
  })

  it('bryr sig inte om mejl utanför listorna', () => {
    expect(skickat({ to: adr('vän@gmail.com'), datum, amne: 'Middag' }, ix)).toBeNull()
  })
})

describe('svar och studsar', () => {
  it('ett svar i tråden räknas, ett eget mejl och ett autosvar inte', () => {
    expect(svar({ from: adr('ny@annan.se'), inReplyTo: '<h-abc@naringslivscentralen.se>', references: [], datum }, ix)).toMatchObject({ typ: 'svar' })
    expect(svar({ from: adr('jag@saljaren.se'), references: [], datum }, ix, new Set(['jag@saljaren.se']))).toBeNull()
    expect(svar({ from: adr('info@hotell.se'), references: [], autoSubmitted: 'auto-replied', datum }, ix)).toBeNull()
  })

  it('en studs hittar sitt original i källtexten', () => {
    const m = { from: adr('MAILER-DAEMON@mx.hotell.se'), amne: 'Undelivered Mail', datum }
    expect(ärStuds(m)).toBe(true)
    expect(studs(m, 'Original-Message-ID: <h-abc@naringslivscentralen.se>', ix)).toMatchObject({ originalMessageId: '<h-abc@naringslivscentralen.se>' })
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
