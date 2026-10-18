import type { AppData } from '../types'
import type { SyncConflict } from './types'
export const shouldRestoreDriveOnFirstConnection = (
  hasLocalProgress: boolean,
  hasDriveFile: boolean,
) => !hasLocalProgress && hasDriveFile

export type Comparison =
  { kind: 'restore' } | { kind: 'same' } | { kind: 'conflict'; conflict: SyncConflict }
/** Timestamp comparison is pure; neither samples nor comparison mutate a revision. */
export function compareProgress(
  local: AppData,
  remote: AppData,
  driveFileId: string,
  hasLocalProgress: boolean,
): Comparison {
  if (shouldRestoreDriveOnFirstConnection(hasLocalProgress, true)) return { kind: 'restore' }
  if (remote.updatedAt === local.updatedAt) return { kind: 'same' }
  return {
    kind: 'conflict',
    conflict: {
      local,
      drive: remote,
      driveFileId,
      newer: Date.parse(remote.updatedAt) > Date.parse(local.updatedAt) ? 'drive' : 'local',
    },
  }
}
