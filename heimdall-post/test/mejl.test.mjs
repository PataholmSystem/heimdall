import { describe, expect, it } from 'vitest'
import { byggUtkast, egenText, referenser, svarstext } from '../lib/mejl.mjs'

describe('utkastet', () => {
  it('har Bcc, Message-ID och tråden', async () => {
    const rå = (
      await byggUtkast(
        {
          id: 'U1',
          till: 'info@hotell.se',
          bcc: 'logg-kod00001@in.naringslivscentralen.se',
          amne: 'Hemsida för hotellet',
          text: 'Hej,\n\nVi bygger hemsidor åt hotell.\n\n-- \nSara',
          messageId: '<h-abc@naringslivscentralen.se>',
          inReplyTo: '<forsta@x>',
          references: ['<forsta@x>'],
        },
        'sara@saljaren.se',
      )
    ).toString()
    expect(rå).toMatch(/^Bcc: logg-kod00001@in\.naringslivscentralen\.se/m)
    expect(rå).toMatch(/^Message-ID: <h-abc@naringslivscentralen\.se>/m)
    expect(rå).toMatch(/^In-Reply-To: <forsta@x>/m)
    expect(rå).toMatch(/^X-Heimdall-Utkast: U1/m)
    expect(rå).toMatch(/^To: info@hotell\.se/m)
    expect(rå).toMatch(/^From: sara@saljaren\.se/m)
  })

  it('skickas från den adress listan valt', async () => {
    const rå = (await byggUtkast({ id: 'U2', till: 'a@b.se', bcc: 'logg-x@in.naringslivscentralen.se', amne: 'Hej', text: 'Text', messageId: '<m@n>' }, 'marcus@geoquestr.com')).toString()
    expect(rå).toMatch(/^From: marcus@geoquestr\.com/m)
  })
})

describe('texterna', () => {
  it('klipper bort det citerade i ett svar', () => {
    expect(svarstext('Tack, ring mig i maj.\n\nDen 17 okt. 2026 skrev Sara <s@x.se>:\n> Hej')).toBe('Tack, ring mig i maj.')
    expect(svarstext('Ja!\n-----Original Message-----\nFrom: x')).toBe('Ja!')
  })

  it('tar bort hälsning och sidfot ur det egna mejlet', () => {
    expect(egenText('Hej Karin,\nVi bygger hemsidor.\n-- \nSara')).toBe('Vi bygger hemsidor.')
  })

  it('läser References över flera rader', () => {
    expect(referenser('Subject: x\r\nReferences: <a@b>\r\n <c@d>\r\nTo: y')).toEqual(['<a@b>', '<c@d>'])
  })
})
