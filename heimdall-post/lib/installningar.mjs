import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Inställningarna som inte är hemliga – vilken korg, vilken server, vilken
 * Heimdall – och synkens vattenmärken. Lösenord och tokens ligger i
 * nyckelringen (hemligheter.mjs), aldrig här.
 */

export function katalog() {
  if (process.env.HEIMDALL_POST_KATALOG) return process.env.HEIMDALL_POST_KATALOG
  if (process.platform === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'heimdall-post')
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'heimdall-post')
}

function läs(namn, annars) {
  try {
    return JSON.parse(readFileSync(join(katalog(), namn), 'utf8'))
  } catch {
    return annars
  }
}

/** Skriver hela filen till en tillfällig och byter namn – en halvskriven fil blir aldrig kvar. */
function skriv(namn, data) {
  mkdirSync(katalog(), { recursive: true, mode: 0o700 })
  const väg = join(katalog(), namn)
  writeFileSync(`${väg}.tmp`, JSON.stringify(data, null, 2), { mode: 0o600 })
  renameSync(`${väg}.tmp`, väg)
}

/**
 * Inställningarna. HEIMDALL_URL pekar ut en annan Heimdall – en
 * utvecklingsserver – och har då egna inloggningar i nyckelringen.
 */
export function läsInstallningar() {
  const fil = läs('config.json', {})
  return {
    issuer: (process.env.HEIMDALL_URL || fil.issuer || 'https://naringslivscentralen.se').replace(/\/$/, ''),
    imap: { ...(fil.imap ?? {}) },
    lasSvar: Boolean(fil.lasSvar),
    korgHoppad: Boolean(fil.korgHoppad),
  }
}

export function sparaInstallningar(inst) {
  skriv('config.json', {
    issuer: inst.issuer,
    imap: inst.imap,
    lasSvar: Boolean(inst.lasSvar),
    korgHoppad: Boolean(inst.korgHoppad),
  })
}

export function korgKopplad(inst = läsInstallningar()) {
  return Boolean(inst.imap?.anvandare && (inst.imap.host || inst.imap.forval))
}

export function läsLage() {
  return läs('state.json', { vattenmarken: {}, senastSynk: null, guideOppnad: null })
}

export function sparaLage(läge) {
  skriv('state.json', läge)
}
