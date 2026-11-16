import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './workflows/activities'
import { config } from './config'

export async function runTemporalWorker() {
  const connection = await NativeConnection.connect({
    address: config.temporal.address,
  })
  try {
    const worker = await Worker.create({
      connection,
      namespace: config.temporal.namespace,
      taskQueue: config.temporal.taskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities,
    })

    await worker.run()
  } finally {
    await connection.close()
  }
}
