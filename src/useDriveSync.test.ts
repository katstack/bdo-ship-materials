import { describe, expect, it } from 'vitest'
import { shouldAttemptSilentResume, shouldRestoreDriveOnFirstConnection } from './useDriveSync'

describe('first Drive connection', () => {
  it('restores Drive when the browser only has an unsaved sample', () => {
    expect(shouldRestoreDriveOnFirstConnection(false, true)).toBe(true)
  })

  it('keeps the conflict choice for existing local progress or an empty Drive folder', () => {
    expect(shouldRestoreDriveOnFirstConnection(true, true)).toBe(false)
    expect(shouldRestoreDriveOnFirstConnection(false, false)).toBe(false)
  })

  it('allows one non-interactive resume only for a remembered connection without a token', () => {
    expect(shouldAttemptSilentResume(true, false, false, false)).toBe(true)
    expect(shouldAttemptSilentResume(false, false, false, false)).toBe(false)
    expect(shouldAttemptSilentResume(true, true, false, false)).toBe(false)
    expect(shouldAttemptSilentResume(true, false, false, true)).toBe(false)
  })
})
