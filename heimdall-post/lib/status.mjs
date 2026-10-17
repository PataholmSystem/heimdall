import { readFileSync } from 'node:fs'
import { FORVAL } from './forval.mjs'
import { anropa, inloggad } from './heimdall.mjs'
import { korgKopplad, läsInstallningar, läsLage } from './installningar.mjs'

/**
 * Säger till Heimdall vad som är kopplat – vilken e-post, var utkasten hamnar,
 * när den senast synkade – så att naringslivscentralen.se kan visa det.
 * Lösenordet och korgens innehåll följer aldrig med. Tyst om det inte går:
 * det är en visning, inget som får stoppa något.
 */
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version ?? null
  } catch {
    return null
  }
})()

export async function rapportera() {
  if (!inloggad()) return
  const inst = läsInstallningar()
  const kopplad = korgKopplad(inst)
  try {
    await anropa('POST', '/api/post/status', {
      version: VERSION,
      korg: {
        kopplad,
        hoppad: inst.korgHoppad,
        adress: kopplad ? (inst.imap.fran ?? inst.imap.anvandare ?? null) : null,
        typ: kopplad ? (FORVAL[inst.imap.forval] ?? FORVAL.annan).namn : null,
        utkastMapp: kopplad ? (inst.imap.utkastMapp ?? null) : null,
      },
      lasSvar: inst.lasSvar,
      senastSynk: läsLage().senastSynk ?? null,
    })
  } catch {
    // Visningen på sajten väntar till nästa gång.
  }
}
