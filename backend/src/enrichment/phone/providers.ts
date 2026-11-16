import { PhoneLookupLead, PhoneProviderId } from './plan'

/** A ready-to-send provider call. Credentials are added here, never stored in workflow history. */
export type ProviderRequest = {
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

export type ProviderCredentials = Record<PhoneProviderId, string>

/**
 * Adapter for one phone provider: it maps a lead to the provider's input and the provider's
 * output back to a phone. `buildRequest` returns a reason string when the lead lacks the inputs
 * this provider needs, so the workflow can skip it instead of sending a request bound to fail.
 */
export type PhoneProviderAdapter = {
  id: PhoneProviderId
  buildRequest(lead: PhoneLookupLead, apiKey: string, baseUrl: string): ProviderRequest | string
  parsePhone(body: unknown): string | null
}

const JSON_HEADERS = { 'content-type': 'application/json' }

export const phoneProviders: Record<PhoneProviderId, PhoneProviderAdapter> = {
  orionConnect: {
    id: 'orionConnect',
    buildRequest(lead, apiKey, baseUrl) {
      const companyWebsite = companyWebsiteFromEmail(lead.email)
      if (!companyWebsite) return 'needs a company website (lead has a personal email domain)'
      return {
        url: `${baseUrl}/orionConnect`,
        headers: { ...JSON_HEADERS, 'x-auth-me': apiKey },
        body: { fullName: `${lead.firstName} ${lead.lastName}`.trim(), companyWebsite },
      }
    },
    parsePhone: (body) => normalizePhone(field(body, 'phone')),
  },
  astraDialer: {
    id: 'astraDialer',
    buildRequest(lead, apiKey, baseUrl) {
      return {
        url: `${baseUrl}/astraDialer`,
        headers: { ...JSON_HEADERS, apiKey },
        body: { email: lead.email },
      }
    },
    parsePhone: (body) => normalizePhone(field(body, 'phoneNmbr')),
  },
  nimbusLookup: {
    id: 'nimbusLookup',
    buildRequest(lead, apiKey, baseUrl) {
      if (!lead.jobTitle?.trim()) return 'needs a job title'
      return {
        // The provider's path really is spelled "numbusLookup".
        url: `${baseUrl}/numbusLookup?api=${encodeURIComponent(apiKey)}`,
        headers: JSON_HEADERS,
        body: { email: lead.email, jobTitle: lead.jobTitle.trim() },
      }
    },
    // Documented as `number`, but the live API answers with `phoneNmbr`; accept both.
    parsePhone: (body) => normalizePhone(field(body, 'number') ?? field(body, 'phoneNmbr')),
  },
}

function field(body: unknown, key: string): unknown {
  return body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined
}

/** Accepts a string or number; returns null for missing, empty or non-phone values. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /\d/.test(trimmed) ? trimmed : null
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'yandex.com',
])

/**
 * Leads have no company website field, so it is derived from a work email's domain
 * (`ada@acme.com` -> `acme.com`). Personal mailbox domains say nothing about the company.
 */
export function companyWebsiteFromEmail(email: string): string | null {
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain || !domain.includes('.')) return null
  return PERSONAL_EMAIL_DOMAINS.has(domain) ? null : domain
}
