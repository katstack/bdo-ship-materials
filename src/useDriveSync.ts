import { SERVER_AUTH_API_URL } from './serverAuth'
import { useServerDriveSync } from './useServerDriveSync'
import { useLegacyDriveSync } from './useLegacyDriveSync'
export type { DriveStatus, SyncConflict, DriveSyncController } from './sync/types'
export { shouldRestoreDriveOnFirstConnection } from './sync/policy'
// Stable build-time selection: neither adapter starts OAuth during restoration.
export const useDriveSync = SERVER_AUTH_API_URL ? useServerDriveSync : useLegacyDriveSync
