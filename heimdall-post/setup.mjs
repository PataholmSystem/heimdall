import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'
import { FORVAL } from './lib/forval.mjs'
import { anropa, inloggad, loggaUt, påbörjaInloggning } from './lib/heimdall.mjs'
import { raderaHemlighet, sparaHemlighet } from './lib/hemligheter.mjs'
import { anslut, mappar } from './lib/imap.mjs'
import { katalog, läsInstallningar, läsLage, sparaInstallningar } from './lib/installningar.mjs'
import { påbörjaMicrosoft } from './lib/microsoft.mjs'

/**
 * `heimdall-post setup | status | logout` – installationen i terminalen.
 *
 * Fem minuter: välj korg, skapa ett applösenord, testa anslutningen, logga in
 * mot Heimdall med en kod i webbläsaren. Lösenordet hamnar i nyckelringen och
 * skrivs aldrig ut.
 */

function fråga(text, { dold = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true })
    if (dold) {
      // Ekot stängs av efter frågan, så att lösenordet inte syns medan det skrivs.
      rl._writeToOutput = (s) => {
        if (!rl.dolt) stdout.write(s)
      }
    }
    rl.question(text, (svar) => {
      rl.close()
      if (dold) stdout.write('\n')
      resolve(svar.trim())
    })
    if (dold) rl.dolt = true
  })
}

const rubrik = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`)

async function setup(args) {
  const inst = läsInstallningar()
  const url = args.find((a) => a.startsWith('--url='))?.slice(6) ?? (args.includes('--url') ? args[args.indexOf('--url') + 1] : null)
  if (url) inst.issuer = url.replace(/\/$/, '')

  console.log('heimdall-post lägger Heimdalls mejlutkast bland dina egna utkast och loggar det du skickar.')
  console.log('Den skickar aldrig mejl. Lösenordet sparas i datorns nyckelring.')

  rubrik('1. Din mejlkorg')
  const nycklar = Object.keys(FORVAL)
  nycklar.forEach((k, i) => console.log(`  ${i + 1}. ${FORVAL[k].namn}`))
  const val = Number(await fråga(`Välj (1–${nycklar.length}): `))
  const forval = nycklar[val - 1] ?? 'annan'
  const f = FORVAL[forval]
  console.log(`\n${f.hjalp}\n`)

  const imap = { forval, auth: f.auth }
  if (forval === 'annan') {
    imap.host = await fråga('IMAP-server (t.ex. imap.example.se): ')
    imap.port = Number((await fråga('Port [993]: ')) || 993)
    imap.secure = imap.port === 993
  }
  imap.anvandare = await fråga(forval === 'proton' ? 'Bridges användarnamn: ' : 'Din e-postadress: ')
  imap.fran = imap.anvandare
  if (forval === 'proton') {
    imap.bridgeCert = await fråga('Sökvägen till Bridges exporterade certifikat (cert.pem): ')
    if (!existsSync(imap.bridgeCert)) throw new Error('Filen finns inte.')
    const fran = await fråga(`Adressen du skickar från [${imap.anvandare}]: `)
    if (fran) imap.fran = fran
  }

  if (f.auth === 'microsoft') {
    const ms = await påbörjaMicrosoft()
    console.log(`\nÖppna ${ms.adress} och skriv koden ${ms.kod}`)
    await ms.väntaPåSvar()
    console.log('Inloggad mot Microsoft.')
  } else {
    const lösen = await fråga(forval === 'proton' ? 'Bridges lösenord: ' : 'Applösenordet: ', { dold: true })
    sparaHemlighet('imap-losenord', lösen)
  }

  inst.imap = imap
  sparaInstallningar(inst)
  process.stdout.write('Testar anslutningen … ')
  const klient = await anslut(inst)
  const m = await mappar(klient)
  await klient.logout()
  console.log('ok.')
  console.log(`  Utkast: ${m.utkast ?? 'hittades inte'} · Skickat: ${m.skickat ?? 'hittades inte'}`)
  if (!m.utkast) console.log('  Utan en Utkast-mapp kan hjälparen bara synka, inte lägga utkast.')

  rubrik('2. Heimdall')
  if (inloggad()?.issuer === inst.issuer) {
    console.log('Redan inloggad.')
  } else {
    const l = await påbörjaInloggning(inst.issuer)
    console.log(`Öppna ${l.adressMedKod || l.adress}`)
    console.log(`och godkänn koden \x1b[1m${l.kod}\x1b[0m. Väntar …`)
    await l.väntaPåSvar()
  }
  const konto = await anropa('GET', '/api/post/konto')
  console.log(`Inloggad som ${konto.anvandare.namn || konto.anvandare.epost} för ${konto.foretag.namn}.`)

  rubrik('3. Svaren')
  console.log('När prospekten svarar kan AI-assistenten läsa svaren och föreslå vad de betydde.')
  console.log('Svaren är skrivna av andra och skickas då till AI-tjänsten. Annars ser den bara att det kommit ett svar.')
  inst.lasSvar = /^j/i.test(await fråga('Får AI-assistenten läsa svaren? (j/N): '))
  sparaInstallningar(inst)

  rubrik('Klart')
  const fran = imap.fran.toLowerCase()
  if (!konto.avsandare.map((a) => a.toLowerCase()).includes(fran)) {
    console.log(`Lägg till ${imap.fran} som avsändaradress på ${inst.issuer}/konto/ai och skicka ett mejl därifrån`)
    console.log(`till ${konto.loggadress} – då loggas också det du skickar när hjälparen inte är igång.`)
  }
  console.log('I Claude Code följer hjälparen med pluginen "heimdall". I Claude Desktop: installera heimdall-post.mcpb.')
}

async function status() {
  const inst = läsInstallningar()
  console.log(`Inställningar: ${katalog()}`)
  console.log(`Heimdall: ${inst.issuer} – ${inloggad() ? 'inloggad' : 'inte inloggad'}`)
  console.log(`Korg: ${FORVAL[inst.imap.forval]?.namn ?? 'inte inställd'}${inst.imap.anvandare ? ` (${inst.imap.anvandare})` : ''}`)
  console.log(`Läsa svar: ${inst.lasSvar ? 'ja' : 'nej'} · Senast synkat: ${läsLage().senastSynk ?? 'aldrig'}`)
  if (inloggad()) {
    const konto = await anropa('GET', '/api/post/konto').catch((e) => ({ fel: e.message }))
    console.log(konto.fel ? `Heimdall svarar inte: ${konto.fel}` : `Företag: ${konto.foretag.namn} · loggadress: ${konto.loggadress}`)
  }
}

async function logout() {
  await loggaUt()
  raderaHemlighet('imap-losenord')
  raderaHemlighet('microsoft-token')
  console.log('Utloggad. Lösenordet och inloggningen är borttagna ur nyckelringen.')
}

export async function cli(kommando, args) {
  try {
    if (kommando === 'setup') await setup(args)
    else if (kommando === 'status') await status()
    else if (kommando === 'logout') await logout()
    else {
      console.log('heimdall-post setup [--url <adress>] | status | logout')
      console.log('Utan argument startar MCP-servern (det AI-klienten gör).')
    }
  } catch (e) {
    console.error(`\nFel: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  }
}
