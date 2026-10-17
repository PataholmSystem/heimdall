import { FORVAL } from './lib/forval.mjs'
import { startaGuide } from './lib/guide.mjs'
import { anropa, inloggad, loggaUt } from './lib/heimdall.mjs'
import { imapNyckel, microsoftNyckel, raderaHemlighet } from './lib/hemligheter.mjs'
import { katalog, läsInstallningar, läsLage, sparaInstallningar } from './lib/installningar.mjs'
import { öppna } from './lib/oppna.mjs'

/**
 * `heimdall-post setup | status | logout` för den som kör hjälparen från en
 * terminal. Setup öppnar samma guide i webbläsaren som Claude Desktop gör – det
 * finns ett sätt att ställa in hjälparen, inte två.
 */

async function setup(args) {
  const i = args.indexOf('--url')
  const url = args.find((a) => a.startsWith('--url='))?.slice(6) ?? (i >= 0 ? args[i + 1] : null)
  if (url) sparaInstallningar({ ...läsInstallningar(), issuer: url.replace(/\/$/, '') })
  await new Promise((resolve) => {
    startaGuide({ vidKlar: () => setTimeout(resolve, 500) }).then((guide) => {
      öppna(guide.url)
      console.log('Guiden är öppen i webbläsaren. Om den inte syns, öppna:')
      console.log(`  ${guide.url}`)
      console.log('Följ stegen där. Det här fönstret stängs när du är klar.')
    })
  })
  console.log('Klart.')
  process.exit(0)
}

async function status() {
  const inst = läsInstallningar()
  console.log(`Inställningar: ${katalog()}`)
  console.log(`Heimdall: ${inst.issuer} – ${inloggad() ? 'inloggad' : 'inte inloggad'}`)
  console.log(
    `E-post: ${inst.imap.anvandare ? `${(FORVAL[inst.imap.forval] ?? FORVAL.annan).namn} (${inst.imap.fran ?? inst.imap.anvandare})` : inst.korgHoppad ? 'inte kopplad – utkastlådan används' : 'inte kopplad'}`,
  )
  console.log(`Claude får läsa svar: ${inst.lasSvar ? 'ja' : 'nej'} · Senast synkat: ${läsLage().senastSynk ?? 'aldrig'}`)
  if (inloggad()) {
    const konto = await anropa('GET', '/api/post/konto').catch((e) => ({ fel: e.message }))
    console.log(konto.fel ? `Heimdall svarar inte: ${konto.fel}` : `Företag: ${konto.foretag.namn} · loggadress: ${konto.loggadress}`)
  }
}

async function logout() {
  const inst = läsInstallningar()
  await loggaUt()
  if (inst.imap.anvandare) {
    raderaHemlighet(imapNyckel(inst.imap.anvandare))
    raderaHemlighet(microsoftNyckel(inst.imap.anvandare))
  }
  raderaHemlighet('imap-losenord')
  sparaInstallningar({ ...inst, imap: {}, korgHoppad: false })
  console.log('Utloggad. Lösenordet och inloggningen är borttagna ur nyckelringen.')
}

export async function cli(kommando, args) {
  try {
    if (kommando === 'setup') await setup(args)
    else if (kommando === 'status') await status()
    else if (kommando === 'logout') await logout()
    else {
      console.log('heimdall-post setup [--url <adress>] | status | logout')
      console.log('Utan argument startar MCP-servern (det Claude gör).')
    }
  } catch (e) {
    console.error(`\nFel: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  }
}
