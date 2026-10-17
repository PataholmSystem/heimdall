import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { sökväg } from '../setup.mjs'

describe('sökvägen till certifikatet', () => {
  it('tål ~, citattecken och mellanslag som terminalen escapat', () => {
    expect(sökväg('~/cert.pem')).toBe(`${homedir()}/cert.pem`)
    expect(sökväg("'/Users/x/Mina filer/cert.pem' ")).toBe('/Users/x/Mina filer/cert.pem')
    expect(sökväg('/Users/x/Mina\\ filer/cert.pem')).toBe('/Users/x/Mina filer/cert.pem')
  })
})
