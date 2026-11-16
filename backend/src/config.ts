import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseEnv } from 'util'

// Instance settings live in the repo-root `.env` (one per worktree), shared with the frontend.
// Variables already set in the shell win over the file.
const rootEnvFile = resolve(__dirname, '../../.env')
if (existsSync(rootEnvFile)) {
  const parsed = parseEnv(readFileSync(rootEnvFile, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function readPort(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a port number between 1 and 65535, got "${raw}"`)
  }
  return port
}

/** Optional positive number; unset means "no limit". */
function readRate(name: string): number | undefined {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return undefined
  const rate = Number(raw)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`${name} must be a positive number of requests per second, got "${raw}"`)
  }
  return rate
}

export const config = {
  backendPort: readPort('BACKEND_PORT', 4000),
  frontendPort: readPort('FRONTEND_PORT', 5173),
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'myQueue',
  },
  phoneProviders: {
    baseUrl: process.env.PHONE_PROVIDERS_BASE_URL || 'https://api.enginy.ai/api/tmp',
    // Defaults are the take-home's sandbox keys from the README; real keys belong in `.env`.
    credentials: {
      orionConnect: process.env.ORION_CONNECT_API_KEY || 'mySecretKey123',
      astraDialer: process.env.ASTRA_DIALER_API_KEY || '1234jhgf',
      nimbusLookup: process.env.NIMBUS_LOOKUP_API_KEY || '000099998888',
    },
    // Requests per second across all workers (Temporal task-queue rate limit). Unset = unlimited.
    maxRequestsPerSecond: {
      orionConnect: readRate('ORION_CONNECT_MAX_RPS'),
      astraDialer: readRate('ASTRA_DIALER_MAX_RPS'),
      nimbusLookup: readRate('NIMBUS_LOOKUP_MAX_RPS'),
    },
  },
} as const
