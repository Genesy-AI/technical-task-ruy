import { describe, it, expect } from 'vitest'
import { validateBulkLead } from './leadValidation'
import { COUNTRY_CODES, checkCountryCode } from '../../../shared/countryCodes'

const baseLead = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
}

describe('COUNTRY_CODES', () => {
  it('should contain the 249 ISO 3166-1 alpha-2 codes, unique and uppercase', () => {
    expect(COUNTRY_CODES).toHaveLength(249)
    expect(new Set(COUNTRY_CODES).size).toBe(249)
    COUNTRY_CODES.forEach((code) => expect(code).toMatch(/^[A-Z]{2}$/))
  })
})

describe('checkCountryCode', () => {
  it('should accept valid codes ignoring case and surrounding spaces', () => {
    expect(checkCountryCode('ES')).toEqual({ valid: true, value: 'ES' })
    expect(checkCountryCode('es')).toEqual({ valid: true, value: 'ES' })
    expect(checkCountryCode('Us')).toEqual({ valid: true, value: 'US' })
    expect(checkCountryCode('  fr  ')).toEqual({ valid: true, value: 'FR' })
  })

  it('should treat missing or blank values as no country', () => {
    expect(checkCountryCode(undefined)).toEqual({ valid: true, value: null })
    expect(checkCountryCode(null)).toEqual({ valid: true, value: null })
    expect(checkCountryCode('')).toEqual({ valid: true, value: null })
    expect(checkCountryCode('   ')).toEqual({ valid: true, value: null })
  })

  it('should reject numbers', () => {
    expect(checkCountryCode('12')).toMatchObject({ valid: false })
    expect(checkCountryCode(12)).toMatchObject({ valid: false })
  })

  it('should reject values longer than 2 characters', () => {
    expect(checkCountryCode('XXX')).toMatchObject({ valid: false })
    expect(checkCountryCode('ESP')).toMatchObject({ valid: false })
    expect(checkCountryCode('Spain')).toMatchObject({ valid: false })
  })

  it('should reject 2-letter codes that are not ISO 3166-1 alpha-2', () => {
    expect(checkCountryCode('UK')).toMatchObject({ valid: false })
    expect(checkCountryCode('XX')).toMatchObject({ valid: false })
    expect(checkCountryCode('zz')).toMatchObject({ valid: false })
  })

  it('should reject single characters', () => {
    expect(checkCountryCode('E')).toMatchObject({ valid: false })
  })

  it('should include the offending value in the error message', () => {
    expect(checkCountryCode(' XXX ')).toEqual({
      valid: false,
      error: 'Invalid country code "XXX": must be an ISO 3166-1 alpha-2 code',
    })
  })
})

describe('validateBulkLead', () => {
  it('should accept a lead with a valid country code and normalize it', () => {
    const result = validateBulkLead({ ...baseLead, countryCode: ' es ', jobTitle: ' Dev ', companyName: '' })

    expect(result).toEqual({
      valid: true,
      lead: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        jobTitle: 'Dev',
        countryCode: 'ES',
        companyName: null,
      },
    })
  })

  it('should accept a lead without a country code', () => {
    const result = validateBulkLead(baseLead)

    expect(result).toMatchObject({ valid: true, lead: { countryCode: null } })
  })

  it.each(['12', 'XXX', 'UK', 'Spain'])('should reject the lead when countryCode is %s', (countryCode) => {
    const result = validateBulkLead({ ...baseLead, countryCode })

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.errors).toEqual([
        `Invalid country code "${countryCode}": must be an ISO 3166-1 alpha-2 code`,
      ])
    }
  })

  it('should report every error of the lead together', () => {
    const result = validateBulkLead({ firstName: 'John', lastName: ' ', email: '', countryCode: 'XXX' })

    expect(result).toEqual({
      valid: false,
      errors: [
        'Last name is required',
        'Email is required',
        'Invalid country code "XXX": must be an ISO 3166-1 alpha-2 code',
      ],
    })
  })

  it('should reject values that are not objects', () => {
    expect(validateBulkLead(null)).toEqual({ valid: false, errors: ['Lead must be an object'] })
    expect(validateBulkLead('lead')).toEqual({ valid: false, errors: ['Lead must be an object'] })
  })
})
