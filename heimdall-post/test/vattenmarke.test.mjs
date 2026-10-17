import { describe, expect, it } from 'vitest'
import { flytta, nyckel, vadSkaLäsas } from '../lib/vattenmarke.mjs'

describe('vattenmärket', () => {
  const n = nyckel({ host: 'imap.x', anvandare: 'a@x' }, 'Sent')

  it('läser efter datum första gången och efter UID sedan', () => {
    expect(vadSkaLäsas({ vattenmarken: {} }, n, '7')).toHaveProperty('sedan')
    const läge = flytta({ vattenmarken: {} }, n, '7', 120)
    expect(vadSkaLäsas(läge, n, '7')).toEqual({ uidFrån: 121 })
  })

  it('börjar om efter datum när UIDVALIDITY bytts, och flyttar aldrig bakåt', () => {
    const läge = flytta({ vattenmarken: {} }, n, '7', 120)
    expect(vadSkaLäsas(läge, n, '8')).toHaveProperty('sedan')
    expect(flytta(läge, n, '7', 50).vattenmarken[n].uid).toBe(120)
    expect(flytta(läge, n, '8', 50).vattenmarken[n].uid).toBe(50)
  })
})
