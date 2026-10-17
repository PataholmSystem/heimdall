import { resolveMx } from 'node:dns/promises'
import { createConnection } from 'node:net'

/**
 * Vilken mejltjänst en adress hör till, så att användaren bara behöver skriva
 * sin adress. Först de stora domänerna, sedan domänens MX-post – ett företag
 * med egen domän hos Google, Microsoft eller Proton känns igen på den.
 * Testas i test/upptack.test.mjs.
 */

const DOMÄNER = {
  'gmail.com': 'gmail',
  'googlemail.com': 'gmail',
  'outlook.com': 'microsoft',
  'outlook.se': 'microsoft',
  'hotmail.com': 'microsoft',
  'hotmail.se': 'microsoft',
  'live.com': 'microsoft',
  'live.se': 'microsoft',
  'msn.com': 'microsoft',
  'icloud.com': 'icloud',
  'me.com': 'icloud',
  'mac.com': 'icloud',
  'proton.me': 'proton',
  'protonmail.com': 'proton',
  'protonmail.ch': 'proton',
  'pm.me': 'proton',
  'fastmail.com': 'fastmail',
  'fastmail.fm': 'fastmail',
}

const MX = [
  [/(^|\.)(google|googlemail)\.com\.?$/i, 'gmail'],
  [/(^|\.)outlook\.com\.?$/i, 'microsoft'],
  [/(^|\.)protonmail\.ch\.?$/i, 'proton'],
  [/(^|\.)loopia\.se\.?$/i, 'loopia'],
  [/(^|\.)one\.com\.?$/i, 'onecom'],
  [/(^|\.)binero\.se\.?$/i, 'binero'],
  [/(^|\.)messagingengine\.com\.?$/i, 'fastmail'],
  [/(^|\.)icloud\.com\.?$/i, 'icloud'],
]

export function förvalUrMx(värdar) {
  for (const värd of värdar) {
    const träff = MX.find(([mönster]) => mönster.test(värd))
    if (träff) return träff[1]
  }
  return null
}

export function domän(adress) {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(String(adress ?? '').trim().toLowerCase())
  return m ? m[1] : null
}

/** Är Proton Mail Bridge igång på datorn? */
export function bridgeIgång(port = 1143) {
  return new Promise((resolve) => {
    const s = createConnection({ host: '127.0.0.1', port })
    const klar = (svar) => {
      s.destroy()
      resolve(svar)
    }
    s.setTimeout(700, () => klar(false))
    s.once('connect', () => klar(true))
    s.once('error', () => klar(false))
  })
}

export async function identifiera(adress, { mx = resolveMx, bridge = bridgeIgång } = {}) {
  const d = domän(adress)
  if (!d) return null
  let forval = DOMÄNER[d] ?? null
  if (!forval) {
    const poster = await mx(d).catch(() => [])
    forval = förvalUrMx(poster.map((p) => p.exchange))
  }
  const bridgeIgang = await bridge()
  // Okänd tjänst men Bridge är igång: troligen Proton med egen domän.
  if (!forval && bridgeIgang) forval = 'proton'
  return { forval: forval ?? 'annan', domän: d, bridgeIgang, gissadServer: `imap.${d}` }
}
