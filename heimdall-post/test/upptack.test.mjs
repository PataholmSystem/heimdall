import { describe, expect, it } from 'vitest'
import { domän, förvalUrMx, identifiera } from '../lib/upptack.mjs'

const utanBridge = async () => false

describe('igenkänningen av e-posttjänst', () => {
  it('känner igen de stora domänerna utan att fråga DNS', async () => {
    const mx = () => Promise.reject(new Error('ska inte frågas'))
    expect((await identifiera('anna@gmail.com', { mx, bridge: utanBridge })).forval).toBe('gmail')
    expect((await identifiera('anna@hotmail.se', { mx, bridge: utanBridge })).forval).toBe('microsoft')
    expect((await identifiera('anna@proton.me', { mx, bridge: utanBridge })).forval).toBe('proton')
  })

  it('känner igen en egen domän på MX-posten', async () => {
    const mx = (d) => Promise.resolve(d === 'pataholm.se' ? [{ exchange: 'aspmx.l.google.com', priority: 1 }] : [{ exchange: 'mail.protonmail.ch', priority: 10 }])
    expect((await identifiera('marcus@pataholm.se', { mx, bridge: utanBridge })).forval).toBe('gmail')
    expect((await identifiera('marcus@geoquestr.com', { mx, bridge: utanBridge })).forval).toBe('proton')
    expect(förvalUrMx(['foretag-se.mail.protection.outlook.com.'])).toBe('microsoft')
    expect(förvalUrMx(['mailcluster.loopia.se'])).toBe('loopia')
  })

  it('gissar Proton när domänen är okänd men Bridge är igång, och annars en server', async () => {
    const mx = () => Promise.resolve([{ exchange: 'mx.okand.se', priority: 1 }])
    expect((await identifiera('a@okand.se', { mx, bridge: async () => true })).forval).toBe('proton')
    expect(await identifiera('a@okand.se', { mx, bridge: utanBridge })).toMatchObject({ forval: 'annan', gissadServer: 'imap.okand.se' })
  })

  it('godtar bara adresser', async () => {
    expect(domän('inte en adress')).toBeNull()
    expect(await identifiera('nej', { bridge: utanBridge })).toBeNull()
  })
})
