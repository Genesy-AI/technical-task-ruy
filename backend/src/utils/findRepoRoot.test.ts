import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { findRepoRoot } from './findRepoRoot'

const repoRoot = resolve(__dirname, '../../..')

describe('findRepoRoot', () => {
  it('should find the repo root from the source folder (ts-node)', () => {
    expect(findRepoRoot(resolve(repoRoot, 'backend/src'))).toBe(repoRoot)
  })

  it('should find the same repo root from the compiled folder (dist)', () => {
    expect(findRepoRoot(resolve(repoRoot, 'backend/dist/backend/src'))).toBe(repoRoot)
  })

  it('should return undefined when no parent folder has a .env.example', () => {
    expect(findRepoRoot(mkdtempSync(resolve(tmpdir(), 'find-repo-root-')))).toBeUndefined()
  })
})
