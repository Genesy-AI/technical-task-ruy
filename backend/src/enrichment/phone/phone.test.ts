import { describe, expect, it, vi } from 'vitest'
import { ApplicationFailure } from '@temporalio/client'
import { lookupPhoneWithProvider, LookupDeps } from './lookup'
import { PHONE_PROVIDER_PLAN, PhoneLookupLead, PhoneLookupResult, ProviderStep, runPhoneProviderChain } from './plan'
import { companyWebsiteFromEmail, normalizePhone, phoneProviders } from './providers'

const lead: PhoneLookupLead = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  jobTitle: 'CTO',
  companyName: 'Example',
}

const credentials = { orionConnect: 'orion-key', astraDialer: 'astra-key', nimbusLookup: 'nimbus-key' }
const BASE = 'https://providers.test'

function depsWith(response: Response | Error): LookupDeps & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  return { baseUrl: BASE, credentials, timeoutMs: 1000, fetch }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

describe('provider adapters', () => {
  it('builds each provider request with its own input shape and auth', () => {
    expect(phoneProviders.orionConnect.buildRequest(lead, 'k', BASE)).toEqual({
      url: `${BASE}/orionConnect`,
      headers: { 'content-type': 'application/json', 'x-auth-me': 'k' },
      body: { fullName: 'Ada Lovelace', companyWebsite: 'example.com' },
    })
    expect(phoneProviders.astraDialer.buildRequest(lead, 'k', BASE)).toEqual({
      url: `${BASE}/astraDialer`,
      headers: { 'content-type': 'application/json', apiKey: 'k' },
      body: { email: 'ada@example.com' },
    })
    expect(phoneProviders.nimbusLookup.buildRequest(lead, 'k', BASE)).toEqual({
      url: `${BASE}/numbusLookup?api=k`,
      headers: { 'content-type': 'application/json' },
      body: { email: 'ada@example.com', jobTitle: 'CTO' },
    })
  })

  it('skips providers whose required inputs the lead lacks', () => {
    expect(typeof phoneProviders.orionConnect.buildRequest({ ...lead, email: 'ada@gmail.com' }, 'k', BASE)).toBe('string')
    expect(typeof phoneProviders.nimbusLookup.buildRequest({ ...lead, jobTitle: null }, 'k', BASE)).toBe('string')
  })

  it('normalizes each provider response to a phone string or null', () => {
    expect(phoneProviders.orionConnect.parsePhone({ phone: '3911060486' })).toBe('3911060486')
    expect(phoneProviders.orionConnect.parsePhone({ phone: null })).toBeNull()
    expect(phoneProviders.astraDialer.parsePhone({ phoneNmbr: '1451374629' })).toBe('1451374629')
    expect(phoneProviders.astraDialer.parsePhone({})).toBeNull()
    expect(phoneProviders.nimbusLookup.parsePhone({ number: 4784930371, countryCode: 'ES' })).toBe('4784930371')
    expect(phoneProviders.nimbusLookup.parsePhone({ phoneNmbr: 9257804053, countryCode: 'ES' })).toBe('9257804053')
  })

  it('normalizePhone rejects empty and non-phone values', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('  ')).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
    expect(normalizePhone(Number.NaN)).toBeNull()
  })

  it('derives a company website only from work email domains', () => {
    expect(companyWebsiteFromEmail('Ada@Acme.io')).toBe('acme.io')
    expect(companyWebsiteFromEmail('ada@gmail.com')).toBeNull()
    expect(companyWebsiteFromEmail('not-an-email')).toBeNull()
  })
})

describe('lookupPhoneWithProvider', () => {
  it('returns the phone found', async () => {
    const deps = depsWith(json({ phoneNmbr: '123456789' }))
    await expect(lookupPhoneWithProvider('astraDialer', lead, deps)).resolves.toEqual({ outcome: 'found', phone: '123456789' })
  })

  it('returns not_found when the provider has no phone', async () => {
    await expect(lookupPhoneWithProvider('orionConnect', lead, depsWith(json({ phone: null })))).resolves.toEqual({
      outcome: 'not_found',
    })
  })

  it('does not call the provider when inputs are missing', async () => {
    const deps = depsWith(json({}))
    const result = await lookupPhoneWithProvider('nimbusLookup', { ...lead, jobTitle: '' }, deps)
    expect(result.outcome).toBe('skipped')
    expect(deps.fetch).not.toHaveBeenCalled()
  })

  it('makes auth and input errors non-retryable', async () => {
    const auth = lookupPhoneWithProvider('astraDialer', lead, depsWith(new Response('Unauthorized', { status: 401 })))
    await expect(auth).rejects.toMatchObject({ type: 'ProviderAuthError', nonRetryable: true })
    const input = lookupPhoneWithProvider('astraDialer', lead, depsWith(json({ message: 'Missing required input' }, 400)))
    await expect(input).rejects.toMatchObject({ type: 'ProviderInputError', nonRetryable: true })
  })

  it('keeps server errors, network errors and timeouts retryable', async () => {
    for (const response of [json({ message: 'Internal server error' }, 500), new TypeError('fetch failed')]) {
      const error = await lookupPhoneWithProvider('orionConnect', lead, depsWith(response)).catch((e) => e)
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(ApplicationFailure)
    }
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    await expect(lookupPhoneWithProvider('orionConnect', lead, depsWith(timeout))).rejects.toThrow('timed out')
  })

  it('honours Retry-After on 429', async () => {
    const error = await lookupPhoneWithProvider('astraDialer', lead, depsWith(json({}, 429, { 'retry-after': '7' }))).catch(
      (e) => e,
    )
    expect(error).toBeInstanceOf(ApplicationFailure)
    expect(error).toMatchObject({ type: 'ProviderRateLimited', nonRetryable: false, nextRetryDelay: 7000 })
  })
})

describe('runPhoneProviderChain', () => {
  const run = (results: Record<string, PhoneLookupResult | Error>) => {
    const called: string[] = []
    const started: string[] = []
    const promise = runPhoneProviderChain(
      PHONE_PROVIDER_PLAN,
      async (step: ProviderStep) => {
        called.push(step.id)
        const r = results[step.id]
        if (r instanceof Error) throw r
        return r
      },
      async (step) => {
        started.push(step.id)
      },
    )
    return { promise, called, started }
  }

  it('queries providers in order and stops at the first phone', async () => {
    const { promise, called, started } = run({
      orionConnect: { outcome: 'not_found' },
      astraDialer: { outcome: 'found', phone: '555' },
      nimbusLookup: { outcome: 'found', phone: '999' },
    })
    await expect(promise).resolves.toMatchObject({ status: 'found', phone: '555', provider: 'astraDialer' })
    expect(called).toEqual(['orionConnect', 'astraDialer'])
    expect(started).toEqual(['orionConnect', 'astraDialer'])
  })

  it('moves on when a provider fails after its retries', async () => {
    const { promise } = run({
      orionConnect: new Error('orionConnect: HTTP 500'),
      astraDialer: { outcome: 'not_found' },
      nimbusLookup: { outcome: 'found', phone: '999' },
    })
    const result = await promise
    expect(result).toMatchObject({ status: 'found', phone: '999', provider: 'nimbusLookup' })
    expect(result.attempts[0]).toEqual({ provider: 'orionConnect', outcome: 'error', detail: 'orionConnect: HTTP 500' })
  })

  it('reports not_found when providers answered without a phone', async () => {
    const { promise } = run({
      orionConnect: { outcome: 'skipped', reason: 'needs a company website' },
      astraDialer: { outcome: 'not_found' },
      nimbusLookup: new Error('down'),
    })
    await expect(promise).resolves.toMatchObject({ status: 'not_found', phone: null, provider: null })
  })

  it('reports failed when no provider could answer', async () => {
    const { promise } = run({
      orionConnect: new Error('down'),
      astraDialer: new Error('down'),
      nimbusLookup: { outcome: 'skipped', reason: 'needs a job title' },
    })
    await expect(promise).resolves.toMatchObject({ status: 'failed' })
  })
})
