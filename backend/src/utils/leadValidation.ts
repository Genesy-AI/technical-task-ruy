import { checkCountryCode } from '../../../shared/countryCodes'

export interface ValidatedLead {
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
}

export type LeadValidationResult = { valid: true; lead: ValidatedLead } | { valid: false; errors: string[] }

const requiredString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const optionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

/**
 * Validates and normalizes one lead from a bulk import request.
 * firstName, lastName and email are required; countryCode is optional but must be ISO 3166-1 alpha-2.
 */
export const validateBulkLead = (input: unknown): LeadValidationResult => {
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['Lead must be an object'] }
  }

  const raw = input as Record<string, unknown>
  const errors: string[] = []

  const firstName = requiredString(raw.firstName)
  const lastName = requiredString(raw.lastName)
  const email = requiredString(raw.email)

  if (!firstName) errors.push('First name is required')
  if (!lastName) errors.push('Last name is required')
  if (!email) errors.push('Email is required')

  const country = checkCountryCode(raw.countryCode)
  if (!country.valid) errors.push(country.error)

  if (errors.length > 0 || !country.valid) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    lead: {
      firstName,
      lastName,
      email,
      jobTitle: optionalString(raw.jobTitle),
      countryCode: country.value,
      companyName: optionalString(raw.companyName),
    },
  }
}
