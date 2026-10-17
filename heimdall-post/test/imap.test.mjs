import { describe, expect, it } from 'vitest'
import { meddelande } from '../lib/imap.mjs'

describe('meddelandet ur imapflow', () => {
  const kuvert = { messageId: '<a@butik.se>', subject: 'Höstens erbjudanden', from: [{ address: 'info@butik.se' }] }

  it('tar med rubrikerna som visar ett utskick', () => {
    const rubriker = Buffer.from(
      'References: <x@y>\r\nList-Id: Nyheter <nyheter.butik.se>\r\nList-Unsubscribe: <https://butik.se/av>,\r\n <mailto:av@butik.se>\r\nPrecedence: bulk\r\n\r\n',
    )
    const m = meddelande({ uid: 1, envelope: { ...kuvert, date: new Date('2026-10-17T10:00:00Z') }, headers: rubriker })
    expect(m).toMatchObject({
      references: ['<x@y>'],
      listId: 'Nyheter <nyheter.butik.se>',
      listUnsubscribe: '<https://butik.se/av>, <mailto:av@butik.se>',
      precedence: 'bulk',
      datum: '2026-10-17T10:00:00.000Z',
    })
  })

  it('ett mejl utan läsbart datum får inget – inte dagens', () => {
    expect(meddelande({ uid: 2, envelope: kuvert, headers: Buffer.from('') }).datum).toBeNull()
    expect(meddelande({ uid: 3, envelope: { ...kuvert, date: new Date('inte ett datum') }, headers: Buffer.from('') }).datum).toBeNull()
  })
})
