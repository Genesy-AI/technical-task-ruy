import { proxyActivities, workflowInfo } from '@temporalio/workflow'
import type * as activities from './activities'
import {
  PHONE_PROVIDER_PLAN,
  PhoneChainResult,
  PROVIDER_RETRY_POLICY,
  providerTaskQueue,
  runPhoneProviderChain,
} from '../enrichment/phone/plan'

const db = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
  retry: { maximumAttempts: 5, initialInterval: '1 second', backoffCoefficient: 2 },
})

/**
 * Finds a lead's phone by asking Orion Connect, Astra Dialer and Nimbus Lookup in turn, stopping
 * at the first hit. Progress is written to the lead row so the UI can show it while it runs.
 */
export async function enrichPhoneWorkflow(leadId: number): Promise<PhoneChainResult> {
  const lead = await db.loadLeadForPhoneEnrichment(leadId)
  if (!lead) {
    return { status: 'failed', phone: null, provider: null, attempts: [] }
  }

  const { taskQueue } = workflowInfo()
  const lookups = new Map(
    PHONE_PROVIDER_PLAN.map((step) => [
      step.id,
      proxyActivities<typeof activities>({
        taskQueue: providerTaskQueue(taskQueue, step.id),
        startToCloseTimeout: step.timeoutMs,
        // Bounds the time spent waiting in a rate-limited queue plus all retries.
        scheduleToCloseTimeout: '2 minutes',
        retry: { ...PROVIDER_RETRY_POLICY, nonRetryableErrorTypes: [...PROVIDER_RETRY_POLICY.nonRetryableErrorTypes] },
      }).lookupPhone,
    ]),
  )

  let result: PhoneChainResult
  try {
    result = await runPhoneProviderChain(
      PHONE_PROVIDER_PLAN,
      (step) => lookups.get(step.id)!(step.id, lead, step.timeoutMs),
      (step) => db.recordPhoneEnrichment(leadId, { status: 'searching', provider: step.id }),
    )
  } catch (error) {
    // Progress writes can fail too; never leave the lead looking "searching" forever.
    await db.recordPhoneEnrichment(leadId, { status: 'failed', provider: null })
    throw error
  }

  await db.recordPhoneEnrichment(leadId, {
    status: result.status,
    provider: result.provider,
    phone: result.phone ?? undefined,
  })
  return result
}
