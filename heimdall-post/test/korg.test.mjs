import { describe, expect, it } from 'vitest'
import { vänligtFel } from '../lib/korg.mjs'

describe('felen när korgen kopplas', () => {
  it('säger vad som är fel med lösenordet, per tjänst', () => {
    expect(vänligtFel({ authenticationFailed: true }, 'gmail').message).toMatch(/applösenord/)
    expect(vänligtFel({ responseText: 'AUTHENTICATIONFAILED' }, 'proton').message).toMatch(/Mailbox details/)
  })

  it('säger att Bridge inte är igång, och när servern inte finns', () => {
    expect(vänligtFel({ code: 'ECONNREFUSED' }, 'proton').message).toMatch(/Bridge är inte igång/)
    expect(vänligtFel({ code: 'ENOTFOUND' }, 'annan').message).toMatch(/Hittar inte/)
    expect(vänligtFel({ code: 'ETIMEDOUT' }, 'loopia').message).toMatch(/svarar inte/)
  })
})
