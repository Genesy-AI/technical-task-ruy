import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { isPhoneEnrichmentInProgress, PHONE_PROVIDER_LABELS } from '../api/types/leads/enrichPhone'
import { LeadsGetManyOutput } from '../api/types/leads/getMany'

/** Announces each lead whose phone enrichment finishes while the page is open. */
export function usePhoneEnrichmentToasts(leads: LeadsGetManyOutput | undefined) {
  const inProgress = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!leads) return
    const stillRunning = new Set<number>()

    for (const lead of leads) {
      if (isPhoneEnrichmentInProgress(lead.phoneEnrichmentStatus)) {
        stillRunning.add(lead.id)
        continue
      }
      if (!inProgress.current.has(lead.id)) continue

      const name = `${lead.firstName} ${lead.lastName ?? ''}`.trim()
      if (lead.phoneEnrichmentStatus === 'found') {
        const by = lead.phoneEnrichmentProvider ? ` via ${PHONE_PROVIDER_LABELS[lead.phoneEnrichmentProvider]}` : ''
        toast.success(`Phone found for ${name}${by}`)
      } else if (lead.phoneEnrichmentStatus === 'not_found') {
        toast(`No phone found for ${name}`)
      } else if (lead.phoneEnrichmentStatus === 'failed') {
        toast.error(`Phone enrichment failed for ${name}`)
      }
    }

    inProgress.current = stillRunning
  }, [leads])
}
