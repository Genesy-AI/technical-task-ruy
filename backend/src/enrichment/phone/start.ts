import { PrismaClient } from '@prisma/client'
import { Client, WorkflowIdConflictPolicy, WorkflowIdReusePolicy } from '@temporalio/client'
import type { enrichPhoneWorkflow } from '../../workflows/enrichPhone'
import { enrichPhoneWorkflowId, PhoneEnrichmentStatus } from './plan'

export type StartPhoneEnrichmentResult = {
  startedCount: number
  skipped: Array<{ leadId: number; reason: string }>
  errors: Array<{ leadId: number; error: string }>
}

const IN_PROGRESS: readonly (string | null)[] = ['queued', 'searching'] satisfies PhoneEnrichmentStatus[]

/**
 * Starts one enrichment workflow per lead and returns right away; the UI follows progress on the
 * lead rows. Idempotent: the workflow id is derived from the lead id and a start for a lead whose
 * workflow is still running attaches to it (USE_EXISTING) instead of starting a second one.
 * Leads that already have a phone are skipped; a finished run (no data, failed) may be retried.
 */
export async function startPhoneEnrichment(
  prisma: PrismaClient,
  client: Client,
  taskQueue: string,
  leadIds: number[],
): Promise<StartPhoneEnrichmentResult> {
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, phone: true, phoneEnrichmentStatus: true, phoneEnrichmentProvider: true },
  })

  const result: StartPhoneEnrichmentResult = { startedCount: 0, skipped: [], errors: [] }
  const found = new Set(leads.map((lead) => lead.id))
  for (const leadId of leadIds) {
    if (!found.has(leadId)) result.skipped.push({ leadId, reason: 'Lead not found' })
  }

  for (const lead of leads) {
    if (lead.phone) {
      result.skipped.push({ leadId: lead.id, reason: 'Lead already has a phone' })
      continue
    }

    const wasInProgress = IN_PROGRESS.includes(lead.phoneEnrichmentStatus)
    if (!wasInProgress) {
      await prisma.lead.update({ where: { id: lead.id }, data: { phoneEnrichmentStatus: 'queued', phoneEnrichmentProvider: null } })
    }

    try {
      await client.workflow.start<typeof enrichPhoneWorkflow>('enrichPhoneWorkflow', {
        taskQueue,
        workflowId: enrichPhoneWorkflowId(lead.id),
        args: [lead.id],
        workflowIdConflictPolicy: WorkflowIdConflictPolicy.USE_EXISTING,
        workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
        workflowExecutionTimeout: '10 minutes',
      })
      result.startedCount += 1
    } catch (error) {
      if (!wasInProgress) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            phoneEnrichmentStatus: lead.phoneEnrichmentStatus,
            phoneEnrichmentProvider: lead.phoneEnrichmentProvider,
          },
        })
      }
      result.errors.push({ leadId: lead.id, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  return result
}
