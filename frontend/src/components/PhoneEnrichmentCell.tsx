import { FC } from 'react'
import {
  isPhoneEnrichmentInProgress,
  PHONE_PROVIDER_LABELS,
  PhoneEnrichmentStatus,
  PhoneProviderId,
} from '../api/types/leads/enrichPhone'

type Props = {
  phone: string | null
  status: PhoneEnrichmentStatus | null
  provider: PhoneProviderId | null
}

export const PhoneEnrichmentCell: FC<Props> = ({ phone, status, provider }) => {
  const providerLabel = provider ? PHONE_PROVIDER_LABELS[provider] : null

  if (isPhoneEnrichmentInProgress(status)) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-700">
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        {status === 'queued' || !providerLabel ? 'Queued…' : `Searching ${providerLabel}…`}
      </div>
    )
  }

  if (phone) {
    return (
      <div className="text-sm text-gray-900" title={providerLabel ? `Found by ${providerLabel}` : undefined}>
        {phone}
      </div>
    )
  }

  if (status === 'not_found') {
    return <span className="text-sm text-gray-500 italic">No data found</span>
  }

  if (status === 'failed') {
    return (
      <span className="text-sm text-red-600" title="No provider could be reached. Try again later.">
        Enrichment failed
      </span>
    )
  }

  return <div className="text-sm text-gray-900">-</div>
}
