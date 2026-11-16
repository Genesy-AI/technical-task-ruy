import { describe, it, expect } from 'vitest'
import { parseLinkedinUrl, parseOptionalText, parseYearsAtCompany } from './leadFields'

describe('parseOptionalText', () => {
  it('trims values and turns blanks into null', () => {
    expect(parseOptionalText('  +1 555 0100 ')).toBe('+1 555 0100')
    expect(parseOptionalText('')).toBeNull()
    expect(parseOptionalText('   ')).toBeNull()
    expect(parseOptionalText(undefined)).toBeNull()
    expect(parseOptionalText(null)).toBeNull()
    expect(parseOptionalText({ a: 1 })).toBeNull()
  })
})

describe('parseYearsAtCompany', () => {
  it('accepts whole numbers from strings and numbers, including 0', () => {
    expect(parseYearsAtCompany('5')).toEqual({ ok: true, value: 5 })
    expect(parseYearsAtCompany(' 12 ')).toEqual({ ok: true, value: 12 })
    expect(parseYearsAtCompany(0)).toEqual({ ok: true, value: 0 })
  })

  it('treats blank values as not set', () => {
    expect(parseYearsAtCompany('')).toEqual({ ok: true, value: null })
    expect(parseYearsAtCompany(undefined)).toEqual({ ok: true, value: null })
  })

  it('rejects negative, decimal, non-numeric and absurd values', () => {
    for (const value of ['-1', '2.5', 'two', '1e2', '81', 'NaN', ['5'], { years: 5 }]) {
      expect(parseYearsAtCompany(value).ok).toBe(false)
    }
  })
})

describe('parseLinkedinUrl', () => {
  it('normalizes profile URLs to https', () => {
    expect(parseLinkedinUrl('https://www.linkedin.com/in/ada-lovelace')).toEqual({
      ok: true,
      value: 'https://www.linkedin.com/in/ada-lovelace',
    })
    expect(parseLinkedinUrl('linkedin.com/in/ada')).toEqual({
      ok: true,
      value: 'https://linkedin.com/in/ada',
    })
    expect(parseLinkedinUrl('http://es.linkedin.com/in/ada')).toEqual({
      ok: true,
      value: 'https://es.linkedin.com/in/ada',
    })
  })

  it('treats blank values as not set', () => {
    expect(parseLinkedinUrl('  ')).toEqual({ ok: true, value: null })
  })

  it('drops credentials, query strings and fragments', () => {
    expect(parseLinkedinUrl('https://user:pw@WWW.LinkedIn.com/in/ada/?utm_source=x#top')).toEqual({
      ok: true,
      value: 'https://www.linkedin.com/in/ada/',
    })
  })

  it('rejects LinkedIn URLs that are not profiles and non-string input', () => {
    for (const value of [
      'linkedin.com/company/acme',
      'linkedin.com/feed',
      'linkedin.com/in/',
      'javascript:alert(1)',
      42,
    ]) {
      expect(parseLinkedinUrl(value).ok).toBe(false)
    }
  })

  it('rejects other domains, look-alike domains and bare domains', () => {
    for (const value of [
      'https://example.com/in/ada',
      'https://notlinkedin.com/in/ada',
      'linkedin.com',
      'not a url',
    ]) {
      expect(parseLinkedinUrl(value).ok).toBe(false)
    }
  })
})
