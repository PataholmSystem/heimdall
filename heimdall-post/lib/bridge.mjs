import { writeFileSync, mkdirSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { connect } from 'node:tls'
import { katalog } from './installningar.mjs'

/**
 * Proton Mail Bridges certifikat, hämtat från Bridge själv första gången.
 *
 * Bridge har ett självsignerat certifikat och körs bara på den egna datorn.
 * I stället för att användaren ska exportera det ur Bridge läser hjälparen
 * det när mejlkorgen kopplas, sparar det och godtar därefter bara exakt det
 * certifikatet (se imap.mjs). Den som skulle kunna byta det i det ögonblicket
 * måste redan ha tagit över datorn.
 */
export function hämtaBridgeCert({ host = '127.0.0.1', port = 1143 } = {}) {
  return new Promise((resolve, reject) => {
    const sock = createConnection({ host, port })
    let buffert = ''
    let steg = 'hälsning'
    const fel = (e) => {
      sock.destroy()
      reject(e instanceof Error ? e : new Error(String(e)))
    }
    sock.setTimeout(6000, () => fel(Object.assign(new Error('Bridge svarar inte.'), { code: 'ETIMEDOUT' })))
    sock.on('error', fel)
    sock.on('data', (bit) => {
      buffert += bit.toString('latin1')
      if (steg === 'hälsning' && /^\* OK/m.test(buffert)) {
        steg = 'starttls'
        buffert = ''
        sock.write('h1 STARTTLS\r\n')
      } else if (steg === 'starttls' && /^h1 (OK|NO|BAD)/m.test(buffert)) {
        if (!/^h1 OK/m.test(buffert)) return fel(new Error('Bridge tog inte emot STARTTLS.'))
        steg = 'tls'
        sock.removeAllListeners('data')
        const t = connect({ socket: sock, rejectUnauthorized: false, servername: undefined })
        t.once('secureConnect', () => {
          const cert = t.getPeerCertificate(true)
          t.end()
          if (!cert?.raw) return reject(new Error('Bridge visade inget certifikat.'))
          const b64 = cert.raw.toString('base64').match(/.{1,64}/g).join('\n')
          resolve(`-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`)
        })
        t.once('error', fel)
      }
    })
  })
}

export function sparaBridgeCert(pem) {
  mkdirSync(katalog(), { recursive: true, mode: 0o700 })
  const väg = join(katalog(), 'bridge-cert.pem')
  writeFileSync(väg, pem, { mode: 0o600 })
  return väg
}
