import { PhoneEnrichmentStatus, PhoneProviderId } from './enrichPhone'

export type LeadsGetManyInput = undefined

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  message: string | null
  emailVerified: boolean | null
  phone: string | null
  phoneEnrichmentStatus: PhoneEnrichmentStatus | null
  phoneEnrichmentProvider: PhoneProviderId | null
}[]
