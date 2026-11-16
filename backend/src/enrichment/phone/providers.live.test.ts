import { describe, expect, it } from 'vitest'
import { config } from '../../config'
import { lookupPhoneWithProvider } from './lookup'
import { PHONE_PROVIDER_PLAN, PhoneLookupLead } from './plan'

// Contract check against the real provider APIs. Opt-in because it hits the network and the
// providers are flaky by design: PHONE_PROVIDERS_LIVE=1 npx vitest run providers.live
const live = process.env.PHONE_PROVIDERS_LIVE === '1'

const lead: PhoneLookupLead = {
  id: 0,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'john.doe@example.com',
  jobTitle: 'CTO',
  companyName: 'Example',
}

describe.skipIf(!live)('phone providers (live API)', () => {
  for (const step of PHONE_PROVIDER_PLAN) {
    it(`${step.label} accepts our request and its answer parses`, { timeout: 60_000 }, async () => {
      // Orion Connect fails on purpose now and then; retry like the activity would.
      let lastError: unknown
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await lookupPhoneWithProvider(step.id, lead, {
            baseUrl: config.phoneProviders.baseUrl,
            credentials: config.phoneProviders.credentials,
            timeoutMs: step.timeoutMs,
          })
          expect(['found', 'not_found']).toContain(result.outcome)
          if (result.outcome === 'found') expect(result.phone).toMatch(/\d/)
          return
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    })
  }

  it('rejects a wrong key as a non-retryable auth error', async () => {
    const result = lookupPhoneWithProvider('astraDialer', lead, {
      baseUrl: config.phoneProviders.baseUrl,
      credentials: { ...config.phoneProviders.credentials, astraDialer: 'wrong-key' },
      timeoutMs: 3000,
    })
    await expect(result).rejects.toMatchObject({ type: 'ProviderAuthError', nonRetryable: true })
  })
})
