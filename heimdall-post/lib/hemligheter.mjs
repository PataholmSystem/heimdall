import { Entry } from '@napi-rs/keyring'

/**
 * Lösenord och tokens i operativsystemets nyckelring: Keychain på macOS,
 * Credential Manager på Windows, Secret Service på Linux. Aldrig i filer,
 * miljövariabler eller argument – utom lösenordet från Claude Desktops
 * formulär, som Desktop själv förvarar och lämnar som miljövariabel.
 */
const TJANST = 'heimdall-post'

export function läsHemlighet(namn) {
  try {
    return new Entry(TJANST, namn).getPassword() ?? null
  } catch {
    return null
  }
}

export function sparaHemlighet(namn, värde) {
  new Entry(TJANST, namn).setPassword(värde)
}

export function raderaHemlighet(namn) {
  try {
    new Entry(TJANST, namn).deletePassword()
  } catch {
    // Fanns inte.
  }
}

export function läsJson(namn) {
  const text = läsHemlighet(namn)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function sparaJson(namn, värde) {
  sparaHemlighet(namn, JSON.stringify(värde))
}
