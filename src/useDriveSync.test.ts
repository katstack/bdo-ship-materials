import { describe, expect, it } from 'vitest'
import { shouldRestoreDriveOnFirstConnection } from './useDriveSync'

describe('first Drive connection', () => {
  it('restores Drive when the browser only has an unsaved sample', () => {
    expect(shouldRestoreDriveOnFirstConnection(false, true)).toBe(true)
  })

  it('keeps the conflict choice for existing local progress or an empty Drive folder', () => {
    expect(shouldRestoreDriveOnFirstConnection(true, true)).toBe(false)
    expect(shouldRestoreDriveOnFirstConnection(false, false)).toBe(false)
  })
})
