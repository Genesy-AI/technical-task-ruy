import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import net from 'node:net'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Instance settings live in the repo-root `.env` (one per worktree), shared with the backend.
// Variables already set in the shell win over the file.
const rootDir = resolve(__dirname, '..')

// Vite re-runs this config on restart while the old server still holds the port, so the
// free-port check only runs once per process.
const PORT_CHECKED_FLAG = '__FRONTEND_PORT_CHECKED'

function readPort(env: Record<string, string>, name: string, fallback: number): number {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a port number between 1 and 65535, got "${raw}"`)
  }
  return port
}

/** Resolves true when something accepts TCP connections on localhost:port. */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = net.connect({ port, host: 'localhost' })
    socket.setTimeout(500)
    socket.once('connect', () => {
      socket.destroy()
      done(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      done(false)
    })
    socket.once('error', () => done(false))
  })
}

/** Prints which ports this instance uses once the dev server is listening. */
function printInstancePorts(frontendPort: number, apiUrl: string): Plugin {
  return {
    name: 'print-instance-ports',
    configureServer(server) {
      server.httpServer?.once('listening', async () => {
        const url = new URL(apiUrl)
        const backendPort = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
        const backendUp = await isPortInUse(backendPort)
        console.log(`\n  Frontend:     http://localhost:${frontendPort}`)
        console.log(`  Backend API:  ${apiUrl}${backendUp ? '' : '  (not responding yet: start the backend)'}\n`)
      })
    },
  }
}

export default defineConfig(async ({ command, mode }) => {
  // Precedence: shell > repo-root .env > frontend/.env*.
  const env = {
    ...loadEnv(mode, __dirname, ''),
    ...loadEnv(mode, rootDir, ''),
    ...process.env,
  } as Record<string, string>
  const frontendPort = readPort(env, 'FRONTEND_PORT', 5173)
  const backendPort = readPort(env, 'BACKEND_PORT', 4000)
  const apiUrl = env.VITE_API_URL || `http://localhost:${backendPort}`

  if (command === 'serve' && !process.env[PORT_CHECKED_FLAG]) {
    if (await isPortInUse(frontendPort)) {
      throw new Error(
        `Port ${frontendPort} is already in use. Set FRONTEND_PORT in the repo-root .env to a free port (see .env.example).`,
      )
    }
    process.env[PORT_CHECKED_FLAG] = '1'
  }

  return {
    plugins: [react(), tailwindcss(), printInstancePorts(frontendPort, apiUrl)],
    server: { port: frontendPort, strictPort: true },
    preview: { port: frontendPort, strictPort: true },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
  }
})
