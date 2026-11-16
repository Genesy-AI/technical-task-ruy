import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  Lead,
  TEMPLATE_FIELDS,
  extractTemplateFields,
  renderTemplatePreview,
  searchTemplateFields,
} from './leadFields'
import { parseCsv } from './utils/csvParser'

const lead: Lead = {
  id: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  jobTitle: null,
  countryCode: 'GB',
  companyName: 'Analytical Engines',
  message: null,
  emailVerified: null,
  phoneNumber: '+44 20 7946 0958',
  yearsAtCompany: 0,
  linkedinUrl: 'https://www.linkedin.com/in/ada',
}

describe('TEMPLATE_FIELDS', () => {
  it('matches the backend generator field list, so the composer offers exactly what can be rendered', () => {
    const backendSource = readFileSync(
      resolve(__dirname, '../../backend/src/utils/messageGenerator.ts'),
      'utf8'
    )
    const backendList = backendSource.match(/TEMPLATE_FIELDS = \[([^\]]*)\]/)?.[1] ?? ''
    const backendKeys = Array.from(backendList.matchAll(/'(\w+)'/g), (match) => match[1])
    expect(backendKeys.length).toBeGreaterThan(0)
    expect([...backendKeys].sort()).toEqual(TEMPLATE_FIELDS.map((field) => field.key).sort())
  })
})

describe('searchTemplateFields', () => {
  it('returns every field for an empty query', () => {
    expect(searchTemplateFields('  ').length).toBeGreaterThanOrEqual(9)
  })

  it('matches labels, keys and keywords', () => {
    expect(searchTemplateFields('mobile').map((f) => f.key)).toEqual(['phoneNumber'])
    expect(searchTemplateFields('linkedin').map((f) => f.key)).toEqual(['linkedinUrl'])
    expect(searchTemplateFields('years company').map((f) => f.key)).toEqual(['yearsAtCompany'])
  })
})

describe('extractTemplateFields', () => {
  it('lists unique placeholders in order', () => {
    expect(extractTemplateFields('{firstName} {phoneNumber} {firstName} {nope}')).toEqual([
      'firstName',
      'phoneNumber',
      'nope',
    ])
  })
})

describe('renderTemplatePreview', () => {
  it('fills known fields, keeps 0 and leaves missing or unknown placeholders visible', () => {
    expect(
      renderTemplatePreview('{firstName}: {yearsAtCompany}y, {jobTitle}, {nope}, {linkedinUrl}', lead)
    ).toBe('Ada: 0y, {jobTitle}, {nope}, https://www.linkedin.com/in/ada')
  })
})

describe('parseCsv new lead fields', () => {
  it('reads phone, years (from the yearsInRole sample header) and LinkedIn', () => {
    const csv = `firstName,lastName,email,yearsInRole,phoneNumber,linkedin
Ada,Lovelace,ada@example.com,3,+1-280-754-0462x2154,linkedin.com/in/ada`
    const [row] = parseCsv(csv)
    expect(row.isValid).toBe(true)
    expect(row.phoneNumber).toBe('+1-280-754-0462x2154')
    expect(row.yearsAtCompany).toBe(3)
    expect(row.linkedinUrl).toBe('https://linkedin.com/in/ada')
  })

  it('accepts the canonical yearsAtCompany and linkedinUrl headers', () => {
    const csv = `firstName,lastName,email,yearsAtCompany,linkedinUrl
Ada,Lovelace,ada@example.com,0,https://www.linkedin.com/in/ada`
    const [row] = parseCsv(csv)
    expect(row.yearsAtCompany).toBe(0)
    expect(row.linkedinUrl).toBe('https://www.linkedin.com/in/ada')
  })

  it('leaves blank optional fields unset', () => {
    const csv = `firstName,lastName,email,yearsAtCompany,phoneNumber,linkedinUrl
Ada,Lovelace,ada@example.com,,,`
    const [row] = parseCsv(csv)
    expect(row.isValid).toBe(true)
    expect(row.phoneNumber).toBeUndefined()
    expect(row.yearsAtCompany).toBeUndefined()
    expect(row.linkedinUrl).toBeUndefined()
  })

  it('flags invalid years and LinkedIn URLs as row errors', () => {
    const csv = `firstName,lastName,email,yearsAtCompany,linkedinUrl
Ada,Lovelace,ada@example.com,-2,https://example.com/ada`
    const [row] = parseCsv(csv)
    expect(row.isValid).toBe(false)
    expect(row.errors).toEqual([
      'Years at company must be a whole number between 0 and 80',
      'LinkedIn URL must point to linkedin.com',
    ])
  })
})
