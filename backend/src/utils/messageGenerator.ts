export interface Lead {
  firstName: string
  lastName?: string | null
  email?: string | null
  jobTitle?: string | null
  companyName?: string | null
  countryCode?: string | null
  phoneNumber?: string | null
  yearsAtCompany?: number | null
  linkedinUrl?: string | null
}

/**
 * Lead fields that can be used as `{placeholder}` in a message template.
 * Adding a field here is all the generator needs; keep the frontend list
 * (frontend/src/leadFields.ts) in sync so the composer offers it.
 */
export const TEMPLATE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'linkedinUrl',
  'jobTitle',
  'yearsAtCompany',
  'companyName',
  'countryCode',
] as const satisfies ReadonlyArray<keyof Lead>

export type TemplateField = (typeof TEMPLATE_FIELDS)[number]

const isTemplateField = (name: string): name is TemplateField =>
  (TEMPLATE_FIELDS as ReadonlyArray<string>).includes(name)

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  const fieldNames = new Set((template.match(/\{(\w+)\}/g) || []).map((variable) => variable.slice(1, -1)))
  const values = new Map<string, string>()

  for (const fieldName of fieldNames) {
    if (!isTemplateField(fieldName)) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }

    const fieldValue = lead[fieldName]
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }

    values.set(fieldName, String(fieldValue))
  }

  // A replacer function keeps `$` in lead values literal (a string replacement would expand `$&`, `$1`...).
  return template.replace(/\{(\w+)\}/g, (match, fieldName: string) => values.get(fieldName) ?? match)
}
