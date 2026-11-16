import { ApplicationFailure } from '@temporalio/client'
import { PhoneLookupLead, PhoneLookupResult, PhoneProviderId } from './plan'
import { phoneProviders, ProviderCredentials } from './providers'

export type LookupDeps = {
  baseUrl: string
  credentials: ProviderCredentials
  timeoutMs: number
  fetch?: typeof fetch
}

/**
 * Calls one provider and classifies the outcome for Temporal's retry policy:
 * - 401/403 and 400/422 are non-retryable (a retry cannot fix bad credentials or input);
 * - 429 is retryable and honours `Retry-After` when the provider sends it;
 * - 5xx, network errors and timeouts are retryable.
 */
export async function lookupPhoneWithProvider(
  providerId: PhoneProviderId,
  lead: PhoneLookupLead,
  deps: LookupDeps,
): Promise<PhoneLookupResult> {
  const provider = phoneProviders[providerId]
  const request = provider.buildRequest(lead, deps.credentials[providerId], deps.baseUrl)
  if (typeof request === 'string') return { outcome: 'skipped', reason: request }

  const doFetch = deps.fetch ?? fetch
  let response: Response
  try {
    response = await doFetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(deps.timeoutMs),
    })
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'network error'
    throw new Error(`${providerId}: ${reason}`)
  }

  if (response.status === 401 || response.status === 403) {
    throw ApplicationFailure.nonRetryable(`${providerId}: unauthorized (${response.status})`, 'ProviderAuthError')
  }
  if (response.status === 400 || response.status === 422) {
    const detail = await response.text().catch(() => '')
    throw ApplicationFailure.nonRetryable(`${providerId}: rejected input ${detail}`.trim(), 'ProviderInputError')
  }
  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers.get('retry-after'))
    throw ApplicationFailure.create({
      message: `${providerId}: rate limited`,
      type: 'ProviderRateLimited',
      nextRetryDelay: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : undefined,
    })
  }
  if (!response.ok) {
    throw new Error(`${providerId}: HTTP ${response.status}`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error(`${providerId}: invalid JSON response`)
  }

  const phone = provider.parsePhone(body)
  return phone ? { outcome: 'found', phone } : { outcome: 'not_found' }
}
