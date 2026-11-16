import { LeadsGetManyOutput } from './api/types/leads/getMany'

export type Lead = LeadsGetManyOutput[number]

export type TemplateFieldKey =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'linkedinUrl'
  | 'jobTitle'
  | 'yearsAtCompany'
  | 'companyName'
  | 'countryCode'

export type FieldGroup = 'Person' | 'Contact' | 'Work'

export interface TemplateField {
  key: TemplateFieldKey
  label: string
  group: FieldGroup
  /** Extra words the composer search matches, e.g. "mobile" for phone. */
  keywords?: string[]
}

/**
 * Lead fields offered as `{placeholder}` in the message composer, in display order.
 * Must match TEMPLATE_FIELDS in backend/src/utils/messageGenerator.ts, which renders the messages.
 */
export const TEMPLATE_FIELDS: TemplateField[] = [
  { key: 'firstName', label: 'First name', group: 'Person', keywords: ['name'] },
  { key: 'lastName', label: 'Last name', group: 'Person', keywords: ['name', 'surname'] },
  { key: 'countryCode', label: 'Country', group: 'Person', keywords: ['location'] },
  { key: 'email', label: 'Email', group: 'Contact', keywords: ['mail'] },
  { key: 'phoneNumber', label: 'Phone number', group: 'Contact', keywords: ['mobile', 'telephone'] },
  { key: 'linkedinUrl', label: 'LinkedIn profile URL', group: 'Contact', keywords: ['social', 'profile'] },
  { key: 'jobTitle', label: 'Job title', group: 'Work', keywords: ['role', 'position'] },
  { key: 'companyName', label: 'Company', group: 'Work', keywords: ['organization', 'employer'] },
  { key: 'yearsAtCompany', label: 'Years at company', group: 'Work', keywords: ['tenure', 'experience'] },
]

export const FIELD_GROUPS: FieldGroup[] = ['Person', 'Contact', 'Work']

const fieldsByKey = new Map<string, TemplateField>(TEMPLATE_FIELDS.map((field) => [field.key, field]))

export const getTemplateField = (key: string): TemplateField | undefined => fieldsByKey.get(key)

export function searchTemplateFields(query: string): TemplateField[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return TEMPLATE_FIELDS

  return TEMPLATE_FIELDS.filter((field) => {
    const haystack = [field.key, field.label, field.group, ...(field.keywords ?? [])].join(' ').toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

export const getFieldValue = (lead: Lead, key: TemplateFieldKey): string | null => {
  const value = lead[key]
  return value === null || value === undefined || value === '' ? null : String(value)
}

/** Placeholder names used in a template, in order of first appearance. */
export const extractTemplateFields = (template: string): string[] =>
  Array.from(new Set(Array.from(template.matchAll(/\{(\w+)\}/g), (match) => match[1])))

/** Client-side preview of what the backend generator produces; missing values stay visible. */
export const renderTemplatePreview = (template: string, lead: Lead): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const field = getTemplateField(key)
    return field ? (getFieldValue(lead, field.key) ?? match) : match
  })
