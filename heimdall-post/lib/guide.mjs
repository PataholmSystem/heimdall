import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { FORVAL } from './forval.mjs'
import { anropa, inloggad, mcpAnrop, påbörjaWebbinloggning } from './heimdall.mjs'
import { korgKopplad, läsInstallningar, sparaInstallningar } from './installningar.mjs'
import { KorgFel, kopplaKorg } from './korg.mjs'
import { klientId, påbörjaMicrosoft } from './microsoft.mjs'
import { anslut, mappar } from './imap.mjs'
import { bridgeIgång, identifiera } from './upptack.mjs'

/**
 * Guiden: installationen som en sida i webbläsaren, för den som aldrig öppnat
 * en terminal. Logga in med Näringslivscentralen, skriv sin e-postadress,
 * följ två–tre steg för just sin e-posttjänst, klart.
 *
 * Den körs i hjälparens egen process och lyssnar bara på 127.0.0.1. Varje
 * start får en hemlig nyckel som står i adressen guiden öppnas med; utan den
 * svarar sidan inte, och API:t kräver den i ett huvud. Värdnamnet prövas mot
 * DNS-rebinding, och sidan får inte ramas in. Annars kunde vilken webbsida som
 * helst i användarens webbläsare prata med guiden och ställa om korgen.
 */

const SIDA = readFileSync(new URL('./guide.html', import.meta.url), 'utf8')
const PORTAR = [47615, 47616, 47617, 47618, 47619]

let aktiv = null

function lyssna(server) {
  return new Promise((resolve, reject) => {
    const prova = (i) => {
      const port = i < PORTAR.length ? PORTAR[i] : 0
      server.once('error', (e) => (e.code === 'EADDRINUSE' && i < PORTAR.length ? prova(i + 1) : reject(e)))
      server.listen(port, '127.0.0.1', () => resolve(server.address().port))
    }
    prova(0)
  })
}

function läsKropp(req) {
  return new Promise((resolve, reject) => {
    let storlek = 0
    const bitar = []
    req.on('data', (b) => {
      storlek += b.length
      if (storlek > 65536) {
        reject(new Error('för stor'))
        req.destroy()
      } else bitar.push(b)
    })
    req.on('end', () => {
      try {
        resolve(bitar.length ? JSON.parse(Buffer.concat(bitar).toString('utf8')) : {})
      } catch {
        reject(new Error('ogiltig JSON'))
      }
    })
  })
}

const SÄKERHET = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
}

function json(res, status, data) {
  res.writeHead(status, { ...SÄKERHET, 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

/** Det guiden behöver veta om en e-posttjänst – stegen, länkarna, vad som ska fyllas i. */
function tjänst(forval) {
  const f = FORVAL[forval] ?? FORVAL.annan
  return {
    forval,
    namn: f.namn,
    auth: f.auth,
    bridge: Boolean(f.bridge),
    steg: f.steg ?? [],
    knapp: f.knapp ?? null,
    lankar: f.lankar ?? [],
    obs: f.obs ?? null,
    losenordEtikett: f.losenordEtikett ?? 'Lösenord',
    host: f.host,
    port: f.port,
    microsoftKlart: f.auth !== 'microsoft' || Boolean(klientId()),
  }
}

/**
 * Startar guiden, en gång per process. `vidInloggning` körs när användaren
 * loggat in (servern meddelar då Claude att verktygen finns), `vidKlar` när
 * hela guiden är gjord.
 */
export async function startaGuide({ vidInloggning, vidKlar } = {}) {
  if (aktiv) return aktiv
  const nyckel = randomBytes(18).toString('base64url')
  let port = 0
  let väntande = null
  let microsoft = { status: 'ingen', fel: null }
  const bas = () => `http://127.0.0.1:${port}`
  const sidAdress = (extra = '') => `${bas()}/?t=${nyckel}${extra}`

  async function hantera(req, res) {
    const url = new URL(req.url, bas())
    const värd = req.headers.host
    if (värd !== `127.0.0.1:${port}` && värd !== `localhost:${port}`) {
      res.writeHead(421, SÄKERHET)
      return res.end()
    }

    if (req.method === 'GET' && url.pathname === '/') {
      if (url.searchParams.get('t') !== nyckel) {
        res.writeHead(403, { ...SÄKERHET, 'Content-Type': 'text/html; charset=utf-8' })
        return res.end('<!doctype html><meta charset="utf-8"><title>Heimdall</title><p style="font-family:system-ui;margin:3rem">Länken har gått ut. Öppna Heimdalls guide igen från Claude.</p>')
      }
      res.writeHead(200, { ...SÄKERHET, 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(SIDA.replace('__NYCKEL__', nyckel))
    }

    // Svaret från inloggningen på naringslivscentralen.se.
    if (req.method === 'GET' && url.pathname === '/callback') {
      const fel = url.searchParams.get('error')
      if (fel || !väntande || url.searchParams.get('state') !== väntande.state) {
        res.writeHead(302, { ...SÄKERHET, Location: sidAdress(`&fel=${fel === 'access_denied' ? 'nekad' : 'inloggning'}`) })
        return res.end()
      }
      try {
        await väntande.avsluta(url.searchParams.get('code'))
        väntande = null
        vidInloggning?.()
        res.writeHead(302, { ...SÄKERHET, Location: sidAdress() })
      } catch {
        res.writeHead(302, { ...SÄKERHET, Location: sidAdress('&fel=inloggning') })
      }
      return res.end()
    }

    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404, SÄKERHET)
      return res.end()
    }
    if (req.headers['x-guide'] !== nyckel) return json(res, 403, { fel: 'Fel nyckel.' })
    const ursprung = req.headers.origin
    if (ursprung && ursprung !== bas() && ursprung !== `http://localhost:${port}`) return json(res, 403, { fel: 'Fel ursprung.' })
    const kropp = req.method === 'POST' ? await läsKropp(req) : {}
    const väg = url.pathname.slice(5)

    if (väg === 'lage') {
      const inst = läsInstallningar()
      let konto = null
      if (inloggad()) {
        try {
          const k = await anropa('GET', '/api/post/konto')
          konto = { namn: k.anvandare.namn || k.anvandare.epost, epost: k.anvandare.epost, foretag: k.foretag.namn }
        } catch {
          konto = null
        }
      }
      return json(res, 200, {
        issuer: inst.issuer,
        inloggad: Boolean(konto),
        konto,
        korg: {
          kopplad: korgKopplad(inst),
          hoppad: inst.korgHoppad,
          adress: inst.imap.fran ?? inst.imap.anvandare ?? null,
          typ: inst.imap.forval ? (FORVAL[inst.imap.forval] ?? FORVAL.annan).namn : null,
        },
        lasSvar: inst.lasSvar,
      })
    }

    if (väg === 'logga-in') {
      väntande = await påbörjaWebbinloggning(läsInstallningar().issuer, `${bas()}/callback`)
      return json(res, 200, { url: väntande.url })
    }

    if (väg === 'identifiera') {
      const svar = await identifiera(String(kropp.adress ?? ''))
      if (!svar) return json(res, 422, { fel: 'Det ser inte ut som en e-postadress.' })
      return json(res, 200, { ...tjänst(svar.forval), bridgeIgang: svar.bridgeIgang, gissadServer: svar.gissadServer })
    }

    if (väg === 'bridge') return json(res, 200, { igang: await bridgeIgång() })

    if (väg === 'korg') {
      const adress = String(kropp.adress ?? '').trim()
      try {
        const hittade = await kopplaKorg({
          adress,
          losenord: String(kropp.losenord ?? ''),
          forval: String(kropp.forval ?? 'annan'),
          anvandare: kropp.anvandare ? String(kropp.anvandare) : undefined,
          host: kropp.host ? String(kropp.host) : undefined,
          port: kropp.port ? Number(kropp.port) : undefined,
        })
        const inst = läsInstallningar()
        sparaInstallningar({ ...inst, korgHoppad: false })
        // Adressen är bevisad – hjälparen har just loggat in i den korgen.
        await anropa('POST', '/api/post/avsandare', { adress }).catch(() => {})
        return json(res, 200, { ok: true, mappar: hittade })
      } catch (e) {
        if (e instanceof KorgFel) return json(res, 422, { fel: e.message, tips: e.tips })
        throw e
      }
    }

    if (väg === 'microsoft' && req.method === 'POST') {
      const adress = String(kropp.adress ?? '').trim()
      const ms = await påbörjaMicrosoft(adress)
      microsoft = { status: 'vantar', fel: null }
      ms.väntaPåSvar().then(
        async () => {
          try {
            const inst = läsInstallningar()
            const imap = { forval: 'microsoft', auth: 'microsoft', anvandare: adress, fran: adress, host: FORVAL.microsoft.host, port: 993, secure: true }
            const klient = await anslut({ ...inst, imap })
            await mappar(klient)
            await klient.logout().catch(() => {})
            sparaInstallningar({ ...inst, imap, korgHoppad: false })
            await anropa('POST', '/api/post/avsandare', { adress }).catch(() => {})
            microsoft = { status: 'klar', fel: null }
          } catch {
            microsoft = { status: 'fel', fel: 'Inloggningen gick, men korgen gick inte att öppna. Har IT-avdelningen stängt av IMAP?' }
          }
        },
        (e) => (microsoft = { status: 'fel', fel: e.message }),
      )
      return json(res, 200, { kod: ms.kod, adress: ms.adress })
    }
    if (väg === 'microsoft') return json(res, 200, microsoft)

    if (väg === 'hoppa-over') {
      sparaInstallningar({ ...läsInstallningar(), korgHoppad: true })
      return json(res, 200, { ok: true })
    }

    if (väg === 'svar') {
      sparaInstallningar({ ...läsInstallningar(), lasSvar: kropp.lasSvar === true })
      return json(res, 200, { ok: true })
    }

    if (väg === 'listor') {
      try {
        const r = await mcpAnrop('tools/call', { name: 'list_lists', arguments: {} })
        const data = JSON.parse(r.content?.[0]?.text ?? '{}')
        return json(res, 200, { listor: (data.listor ?? []).map((l) => l.namn) })
      } catch {
        return json(res, 200, { listor: [] })
      }
    }

    if (väg === 'klar') {
      vidKlar?.()
      return json(res, 200, { ok: true })
    }

    return json(res, 404, { fel: 'Okänd väg.' })
  }

  const server = createServer((req, res) => {
    hantera(req, res).catch((e) => {
      console.error('[heimdall-post] guiden:', e)
      if (!res.headersSent) json(res, 500, { fel: 'Något gick fel. Försök igen.' })
    })
  })
  port = await lyssna(server)
  aktiv = {
    url: sidAdress(),
    port,
    stäng: () => new Promise((r) => server.close(() => r())),
  }
  return aktiv
}

export function guideAktiv() {
  return aktiv
}
