import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './workflows/activities'
import { config } from './config'
import { PHONE_PROVIDER_PLAN, providerTaskQueue } from './enrichment/phone/plan'

export async function runTemporalWorker() {
  const connection = await NativeConnection.connect({
    address: config.temporal.address,
  })
  try {
    const mainWorker = await Worker.create({
      connection,
      namespace: config.temporal.namespace,
      taskQueue: config.temporal.taskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities,
    })

    // One activity-only worker per phone provider, so each provider's calls can be throttled on
    // its own. `maxTaskQueueActivitiesPerSecond` is enforced by the Temporal server across every
    // worker polling the queue, which is what a provider-side rate limit needs.
    const providerWorkers = await Promise.all(
      PHONE_PROVIDER_PLAN.map((step) =>
        Worker.create({
          connection,
          namespace: config.temporal.namespace,
          taskQueue: providerTaskQueue(config.temporal.taskQueue, step.id),
          activities: { lookupPhone: activities.lookupPhone },
          maxTaskQueueActivitiesPerSecond: config.phoneProviders.maxRequestsPerSecond[step.id],
        }),
      ),
    )

    await Promise.all([mainWorker, ...providerWorkers].map((worker) => worker.run()))
  } finally {
    await connection.close()
  }
}
