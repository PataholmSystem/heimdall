import { mkdtempSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

process.env.HEIMDALL_POST_KATALOG = mkdtempSync(join(tmpdir(), 'heimdall-guide-'))
process.env.HEIMDALL_URL = 'http://heimdall.invalid'
const { startaGuide } = await import('../lib/guide.mjs')

/** Ett anrop med valfritt Host-huvud – fetch låter en inte sätta det. */
function anrop(port, väg, { host = `127.0.0.1:${port}`, huvuden = {}, metod = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const r = request({ host: '127.0.0.1', port, path: väg, method: metod, headers: { host, ...huvuden } }, (svar) => {
      let text = ''
      svar.on('data', (b) => (text += b))
      svar.on('end', () => resolve({ status: svar.statusCode, huvuden: svar.headers, text }))
    })
    r.on('error', reject)
    r.end()
  })
}

let guide
beforeAll(async () => {
  guide = await startaGuide()
})
afterAll(() => guide.stäng())

describe('guiden', () => {
  it('lyssnar bara på den egna datorn och visar sidan bara med nyckeln', async () => {
    const nyckel = new URL(guide.url).searchParams.get('t')
    expect(new URL(guide.url).hostname).toBe('127.0.0.1')
    expect((await anrop(guide.port, '/')).status).toBe(403)
    const sida = await anrop(guide.port, `/?t=${nyckel}`)
    expect(sida.status).toBe(200)
    expect(sida.text).toContain('Koppla Heimdall till Claude')
    expect(sida.huvuden['x-frame-options']).toBe('DENY')
    expect(sida.huvuden['referrer-policy']).toBe('no-referrer')
  })

  it('svarar inte på ett annat värdnamn – skydd mot DNS-rebinding', async () => {
    const nyckel = new URL(guide.url).searchParams.get('t')
    expect((await anrop(guide.port, `/?t=${nyckel}`, { host: 'ond.example:80' })).status).toBe(421)
  })

  it('kräver nyckeln i API:t och godtar inte andra webbsidor', async () => {
    const nyckel = new URL(guide.url).searchParams.get('t')
    expect((await anrop(guide.port, '/api/lage')).status).toBe(403)
    expect((await anrop(guide.port, '/api/lage', { huvuden: { 'x-guide': nyckel, origin: 'https://ond.example' } })).status).toBe(403)
    const läge = await anrop(guide.port, '/api/lage', { huvuden: { 'x-guide': nyckel } })
    expect(läge.status).toBe(200)
    expect(JSON.parse(läge.text)).toMatchObject({ inloggad: false, korg: { kopplad: false } })
  })

  it('godtar inte ett svar från inloggningen som den inte bett om', async () => {
    const svar = await anrop(guide.port, '/callback?code=x&state=y')
    expect(svar.status).toBe(302)
    expect(svar.huvuden.location).toContain('fel=inloggning')
  })
})
