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
 * Inställningarna, med miljövariablerna från Claude Desktops formulär (MCPB)
 * ovanpå filen. Där finns inget att köra setup i, så formuläret räcker.
 */
export function läsInstallningar() {
  const fil = läs('config.json', {})
  const env = process.env
  const imap = { ...(fil.imap ?? {}) }
  if (env.HEIMDALL_POST_FORVAL) imap.forval = env.HEIMDALL_POST_FORVAL
  if (env.HEIMDALL_POST_IMAP_HOST) imap.host = env.HEIMDALL_POST_IMAP_HOST
  if (env.HEIMDALL_POST_IMAP_PORT) imap.port = Number(env.HEIMDALL_POST_IMAP_PORT)
  if (env.HEIMDALL_POST_IMAP_USER) imap.anvandare = env.HEIMDALL_POST_IMAP_USER
  if (env.HEIMDALL_POST_FRAN) imap.fran = env.HEIMDALL_POST_FRAN
  if (env.HEIMDALL_POST_BRIDGE_CERT) imap.bridgeCert = env.HEIMDALL_POST_BRIDGE_CERT
  return {
    issuer: env.HEIMDALL_URL || fil.issuer || 'https://naringslivscentralen.se',
    imap,
    lasSvar: env.HEIMDALL_POST_LAS_SVAR ? env.HEIMDALL_POST_LAS_SVAR === 'true' : Boolean(fil.lasSvar),
  }
}

export function sparaInstallningar(inst) {
  skriv('config.json', { issuer: inst.issuer, imap: inst.imap, lasSvar: Boolean(inst.lasSvar) })
}

export function läsLage() {
  return läs('state.json', { vattenmarken: {}, senastSynk: null })
}

export function sparaLage(läge) {
  skriv('state.json', läge)
}
