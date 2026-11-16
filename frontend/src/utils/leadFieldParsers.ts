// Same rules as backend/src/utils/leadFields.ts, run on the client to flag CSV rows before import.

export const MAX_YEARS_AT_COMPANY = 80

export type ParseResult<T> = { ok: true; value: T | null } | { ok: false; error: string }

export function parseYearsAtCompany(value: string | undefined): ParseResult<number> {
  const text = value?.trim() ?? ''
  if (text === '') return { ok: true, value: null }

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
export function parseLinkedinUrl(value: string | undefined): ParseResult<string> {
  const text = value?.trim() ?? ''
  if (text === '') return { ok: true, value: null }

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
