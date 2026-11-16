export interface LeadsBulkImportInput {
  leads: {
    firstName: string
    lastName: string
    email: string
    jobTitle?: string
    countryCode?: string
    companyName?: string
  }[]
}

/** A lead the backend rejected; `index` is its position in the request's `leads` array. */
export interface LeadsBulkImportValidationError {
  index: number
  errors: string[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  validationErrors: LeadsBulkImportValidationError[]
  errors: Array<{
    lead: any
    error: string
  }>
}
