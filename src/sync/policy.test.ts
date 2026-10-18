import { describe, expect, it } from 'vitest'
import { freshSample } from '../storage'
import { compareProgress } from './policy'

describe('Drive reconciliation policy', () => {
  it('restores real Drive progress over a freshly generated sample', () => {
    const local = freshSample(),
      remote = freshSample()
    local.updatedAt = '2026-10-19T00:00:00Z'
    remote.updatedAt = '2026-10-01T00:00:00Z'
    expect(compareProgress(local, remote, 'file', false)).toEqual({ kind: 'restore' })
  })
  it('does not upload equal revisions', () => {
    const data = freshSample()
    expect(compareProgress(data, structuredClone(data), 'file', true)).toEqual({ kind: 'same' })
  })
  it.each(['local', 'drive'] as const)('requires a choice when %s is newer', (newer) => {
    const local = freshSample(),
      remote = freshSample()
    local.updatedAt = newer === 'local' ? '2026-10-19T00:00:00Z' : '2026-10-01T00:00:00Z'
    remote.updatedAt = newer === 'drive' ? '2026-10-19T00:00:00Z' : '2026-10-01T00:00:00Z'
    const before = structuredClone([local, remote])
    expect(compareProgress(local, remote, 'file', true)).toMatchObject({
      kind: 'conflict',
      conflict: { newer, driveFileId: 'file' },
    })
    expect([local, remote]).toEqual(before)
  })
})
