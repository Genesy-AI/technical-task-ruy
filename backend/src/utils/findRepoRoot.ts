import { existsSync } from 'fs'
import { dirname, resolve } from 'path'

/**
 * Walks up from `start` to the repo root, recognized by its committed `.env.example`.
 * Works both from `src/` (ts-node) and from the compiled `dist/backend/src/`.
 */
export function findRepoRoot(start: string): string | undefined {
  let dir = resolve(start)
  while (true) {
    if (existsSync(resolve(dir, '.env.example'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}
