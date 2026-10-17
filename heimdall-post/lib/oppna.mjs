import { spawn } from 'node:child_process'

/** Öppnar en adress i användarens webbläsare. Tyst om det inte går – adressen visas ändå. */
export function öppna(adress) {
  try {
    const [kommando, argument] =
      process.platform === 'darwin'
        ? ['open', [adress]]
        : process.platform === 'win32'
          ? ['cmd', ['/c', 'start', '""', adress.replace(/&/g, '^&')]]
          : ['xdg-open', [adress]]
    const p = spawn(kommando, argument, { detached: true, stdio: 'ignore', windowsHide: true })
    p.on('error', () => {})
    p.unref()
    return true
  } catch {
    return false
  }
}
