import type { AppData } from '../types'
export type DriveStatus = 'disconnected' | 'connecting' | 'synced' | 'failed'
export interface SyncConflict {
  local: AppData
  drive: AppData
  driveFileId: string
  newer: 'local' | 'drive'
}

export interface DriveSyncController {
  status: DriveStatus
  error: string
  lastSavedAt: string | null
  conflict: SyncConflict | null
  authorize: () => void
  reauthorize: () => void
  disconnect: () => void | Promise<void>
  resolveConflict: (choice: 'local' | 'drive') => Promise<void>
  clientId: string
  hasRememberedConnection: boolean
}
