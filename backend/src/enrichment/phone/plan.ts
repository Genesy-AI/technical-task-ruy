// Pure, dependency-free module: it is bundled into the Temporal workflow sandbox, so it must not
// import Node APIs, config or anything with side effects.

export type PhoneProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

export type PhoneEnrichmentStatus = 'queued' | 'searching' | 'found' | 'not_found' | 'failed'

/** The lead fields any provider may need. Each adapter picks what it uses. */
export type PhoneLookupLead = {
  id: number
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  companyName: string | null
}

/** Normalized result of one provider call (errors are thrown, not returned). */
export type PhoneLookupResult =
  | { outcome: 'found'; phone: string }
  | { outcome: 'not_found' }
  | { outcome: 'skipped'; reason: string }

export type ProviderStep = {
  id: PhoneProviderId
  label: string
  /** Activity startToCloseTimeout and HTTP timeout, in milliseconds. */
  timeoutMs: number
}

/**
 * Providers in the order they are queried. Timeouts follow observed latency: Orion Connect is
 * slow (~4-5 s), Astra Dialer answers in well under a second, Nimbus Lookup in ~2 s.
 */
export const PHONE_PROVIDER_PLAN: readonly ProviderStep[] = [
  { id: 'orionConnect', label: 'Orion Connect', timeoutMs: 10_000 },
  { id: 'astraDialer', label: 'Astra Dialer', timeoutMs: 3_000 },
  { id: 'nimbusLookup', label: 'Nimbus Lookup', timeoutMs: 5_000 },
]

/** Retry policy shared by every provider activity. */
export const PROVIDER_RETRY_POLICY = {
  maximumAttempts: 3,
  initialInterval: '1 second',
  backoffCoefficient: 2,
  maximumInterval: '10 seconds',
  nonRetryableErrorTypes: ['ProviderAuthError', 'ProviderInputError'],
} as const

/** Workflow id per lead: Temporal itself guarantees at most one running enrichment per lead. */
export function enrichPhoneWorkflowId(leadId: number): string {
  return `enrich-phone-lead-${leadId}`
}

/** Each provider runs on its own task queue so a per-provider rate limit can be set on it. */
export function providerTaskQueue(baseTaskQueue: string, provider: PhoneProviderId): string {
  return `${baseTaskQueue}-phone-${provider}`
}

export type ProviderAttempt = {
  provider: PhoneProviderId
  outcome: PhoneLookupResult['outcome'] | 'error'
  detail?: string
}

export type PhoneChainResult = {
  status: 'found' | 'not_found' | 'failed'
  phone: string | null
  provider: PhoneProviderId | null
  attempts: ProviderAttempt[]
}

/**
 * Queries providers in order and stops at the first phone found. A provider that fails after its
 * retries does not stop the chain: the next one is tried. The result is `not_found` when at least
 * one provider answered without a phone, and `failed` when none could be queried at all.
 */
export async function runPhoneProviderChain(
  plan: readonly ProviderStep[],
  lookup: (step: ProviderStep) => Promise<PhoneLookupResult>,
  onProviderStart: (step: ProviderStep) => Promise<void>,
): Promise<PhoneChainResult> {
  const attempts: ProviderAttempt[] = []

  for (const step of plan) {
    await onProviderStart(step)
    let result: PhoneLookupResult
    try {
      result = await lookup(step)
    } catch (error) {
      attempts.push({ provider: step.id, outcome: 'error', detail: errorMessage(error) })
      continue
    }

    if (result.outcome === 'found') {
      attempts.push({ provider: step.id, outcome: 'found' })
      return { status: 'found', phone: result.phone, provider: step.id, attempts }
    }
    attempts.push({
      provider: step.id,
      outcome: result.outcome,
      detail: result.outcome === 'skipped' ? result.reason : undefined,
    })
  }

  const anyAnswered = attempts.some((a) => a.outcome === 'not_found')
  return { status: anyAnswered ? 'not_found' : 'failed', phone: null, provider: null, attempts }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Temporal wraps activity errors in ActivityFailure; the useful message is in the cause.
    const cause = (error as { cause?: unknown }).cause
    return cause instanceof Error ? cause.message : error.message
  }
  return String(error)
}
