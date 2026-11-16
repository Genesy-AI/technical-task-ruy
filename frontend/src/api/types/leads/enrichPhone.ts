export type PhoneEnrichmentStatus = 'queued' | 'searching' | 'found' | 'not_found' | 'failed'

export type PhoneProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

export const PHONE_PROVIDER_LABELS: Record<PhoneProviderId, string> = {
  orionConnect: 'Orion Connect',
  astraDialer: 'Astra Dialer',
  nimbusLookup: 'Nimbus Lookup',
}

export const isPhoneEnrichmentInProgress = (status: PhoneEnrichmentStatus | null) =>
  status === 'queued' || status === 'searching'

export type LeadsEnrichPhoneInput = {
  leadIds: number[]
}

export type LeadsEnrichPhoneOutput = {
  success: boolean
  startedCount: number
  skipped: Array<{ leadId: number; reason: string }>
  errors: Array<{ leadId: number; error: string }>
}
