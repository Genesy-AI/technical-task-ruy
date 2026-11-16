import { config } from '../../config'
import { lookupPhoneWithProvider } from '../../enrichment/phone/lookup'
import {
  PhoneEnrichmentStatus,
  PhoneLookupLead,
  PhoneLookupResult,
  PhoneProviderId,
} from '../../enrichment/phone/plan'
import { prisma } from '../../prisma'

export async function loadLeadForPhoneEnrichment(leadId: number): Promise<PhoneLookupLead | null> {
  return prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true, companyName: true },
  })
}

export async function lookupPhone(
  providerId: PhoneProviderId,
  lead: PhoneLookupLead,
  timeoutMs: number,
): Promise<PhoneLookupResult> {
  return lookupPhoneWithProvider(providerId, lead, {
    baseUrl: config.phoneProviders.baseUrl,
    credentials: config.phoneProviders.credentials,
    // Abort the HTTP call just before Temporal's startToCloseTimeout so the failure is reported
    // as "<provider>: timed out" rather than a generic activity timeout.
    timeoutMs: Math.max(timeoutMs - 500, 500),
  })
}

export async function recordPhoneEnrichment(
  leadId: number,
  update: { status: PhoneEnrichmentStatus; provider: PhoneProviderId | null; phone?: string },
): Promise<void> {
  // updateMany: the lead may have been deleted while the workflow ran; that is not an error.
  await prisma.lead.updateMany({
    where: { id: leadId },
    data: {
      phoneEnrichmentStatus: update.status,
      phoneEnrichmentProvider: update.provider,
      ...(update.phone ? { phone: update.phone } : {}),
    },
  })
}
