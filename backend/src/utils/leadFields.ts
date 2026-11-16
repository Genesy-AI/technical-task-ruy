// Parsing and validation for optional lead fields that arrive from clients (CSV import today).
// The frontend runs the same rules (frontend/src/utils/leadFieldParsers.ts) to show errors before
// import; the backend repeats them because it cannot trust the client.

export const MAX_YEARS_AT_COMPANY = 80

export type ParseResult<T> = { ok: true; value: T | null } | { ok: false; error: string }

const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

/** Free text such as a phone number: kept as typed, trimmed; anything that is not a string is ignored. */
export function parseOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

export function parseYearsAtCompany(value: unknown): ParseResult<number> {
  if (isBlank(value)) return { ok: true, value: null }

  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
  const years = Number(text)
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(years) || years > MAX_YEARS_AT_COMPANY) {
    return {
      ok: false,
      error: `Years at company must be a whole number between 0 and ${MAX_YEARS_AT_COMPANY}`,
    }
  }
  return { ok: true, value: years }
}

/** Accepts a LinkedIn profile URL (linkedin.com/in/...) and returns it as a clean https URL. */
export function parseLinkedinUrl(value: unknown): ParseResult<string> {
  if (isBlank(value)) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, error: 'LinkedIn URL is not a valid URL' }

  const text = value.trim()
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { ok: false, error: 'LinkedIn URL is not a valid URL' }
  }

  const host = url.hostname.toLowerCase()
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) {
    return { ok: false, error: 'LinkedIn URL must point to linkedin.com' }
  }
  if (!/^\/in\/[^/]+\/?$/.test(url.pathname)) {
    return { ok: false, error: 'LinkedIn URL must be a profile URL (linkedin.com/in/...)' }
  }

  // Drop credentials, tracking parameters and fragments: only the profile address is stored.
  return { ok: true, value: `https://${host}${url.pathname}` }
}
