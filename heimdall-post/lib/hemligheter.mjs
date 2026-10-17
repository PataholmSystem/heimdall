import { Entry } from '@napi-rs/keyring'

/**
 * Lösenord och tokens i operativsystemets nyckelring: Keychain på macOS,
 * Credential Manager på Windows, Secret Service på Linux. Aldrig i filer,
 * miljövariabler eller argument.
 *
 * Namnen bär vad de gäller – Heimdalls token per adress, mejllösenordet per
 * konto – så att en provinstallation mot en annan Heimdall aldrig skriver
 * över den riktiga.
 */
const TJANST = 'heimdall-post'

export const heimdallNyckel = (issuer) => `heimdall-token@${new URL(issuer).host}`
export const imapNyckel = (anvandare) => `imap-losenord:${String(anvandare).toLowerCase()}`
export const microsoftNyckel = (anvandare) => `microsoft-token:${String(anvandare).toLowerCase()}`

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
