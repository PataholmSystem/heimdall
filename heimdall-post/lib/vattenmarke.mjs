/**
 * Hur långt synken har läst i en mapp: UIDVALIDITY och högsta UID. Byter
 * servern UIDVALIDITY är de gamla numren meningslösa, och synken läser då
 * efter datum i stället. Rent, och testat i test/vattenmarke.test.mjs.
 */

export function nyckel(konto, mapp) {
  return `${konto.host}|${konto.anvandare}|${mapp}`
}

/** Vad som ska läsas: UID efter vattenmärket, eller allt sedan ett datum. */
export function vadSkaLäsas(läge, n, uidValidity, sedanDagar = 30) {
  const v = läge.vattenmarken?.[n]
  if (v && v.uidValidity === String(uidValidity) && Number.isInteger(v.uid)) return { uidFrån: v.uid + 1 }
  return { sedan: new Date(Date.now() - sedanDagar * 86400_000) }
}

export function flytta(läge, n, uidValidity, högstaUid) {
  const v = läge.vattenmarken?.[n]
  const förra = v && v.uidValidity === String(uidValidity) ? v.uid : 0
  return {
    ...läge,
    vattenmarken: { ...läge.vattenmarken, [n]: { uidValidity: String(uidValidity), uid: Math.max(förra, högstaUid) } },
  }
}
