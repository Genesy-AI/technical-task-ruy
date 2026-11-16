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

export const config = {
  backendPort: readPort('BACKEND_PORT', 4000),
  frontendPort: readPort('FRONTEND_PORT', 5173),
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'myQueue',
  },
} as const
