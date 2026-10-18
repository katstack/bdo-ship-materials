import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from './types'
import type { DriveStatus, SyncConflict, DriveSyncController } from './sync/types'
import { compareProgress } from './sync/policy'
import { createSerialQueue } from './sync/serialQueue'
import {
  clearCachedDriveToken,
  DriveRequestError,
  getClientId,
  getDriveFile,
  isDriveConnected,
  saveDriveFile,
  setDriveConnected,
} from './drive'
import { createServerAuthClient, SERVER_AUTH_API_URL, ServerAuthError } from './serverAuth'

export function useServerDriveSync(
  data: AppData,
  replaceLocal: (data: AppData) => void,
  hasLocalProgress: boolean,
): DriveSyncController {
  const [status, setStatus] = useState<DriveStatus>('connecting')
  const [error, setError] = useState(() => {
    const result = new URL(window.location.href).searchParams.get('drive_auth')
    return result && result !== 'connected'
      ? 'Google Drive 연결을 완료하지 못했습니다. 권한과 서버 설정을 확인해 주세요.'
      : ''
  })
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [conflict, setConflict] = useState<SyncConflict | null>(null)
  const [ready, setReady] = useState(false)
  const [hasRememberedConnection, setHasRememberedConnection] = useState(isDriveConnected)
  const [client] = useState(() => createServerAuthClient(SERVER_AUTH_API_URL))
  const latest = useRef({ data, replaceLocal, hasLocalProgress })
  const fileId = useRef<string | undefined>(undefined)
  const uploaded = useRef('')
  const generation = useRef(0)
  const [writes] = useState(createSerialQueue)
  const comparing = useRef(false)
  useEffect(() => {
    latest.current = { data, replaceLocal, hasLocalProgress }
  }, [data, replaceLocal, hasLocalProgress])

  const failed = useCallback(
    (issue: unknown) => {
      setError(issue instanceof Error ? issue.message : 'Drive 동기화에 실패했습니다.')
      if (issue instanceof ServerAuthError && issue.status === 401) {
        client.clear()
        setReady(false)
        setStatus('disconnected')
      } else setStatus('failed')
    },
    [client],
  )

  const withToken = useCallback(
    async <T>(action: (token: string) => Promise<T>) => {
      try {
        return await action(await client.token())
      } catch (issue) {
        if (issue instanceof DriveRequestError && issue.status === 401)
          return action(await client.token(true))
        throw issue
      }
    },
    [client],
  )

  // Serialize uploads so an older slow request cannot overwrite a newer state.
  const write = useCallback(
    (next = latest.current.data) => {
      const current = generation.current
      const operation = writes.run(async () => {
        if (generation.current !== current) return
        try {
          const saved = await withToken((token) => saveDriveFile(token, next, fileId.current))
          if (generation.current !== current) return
          fileId.current = saved.id
          uploaded.current = next.updatedAt
          setLastSavedAt(new Date().toISOString())
          setStatus('synced')
          setError('')
        } catch (issue) {
          if (generation.current === current) failed(issue)
        }
      })
      return operation
    },
    [failed, withToken, writes],
  )

  const compare = useCallback(async () => {
    if (comparing.current) return
    comparing.current = true
    const current = generation.current
    try {
      await writes.idle()
      const remote = await withToken(getDriveFile)
      if (generation.current !== current) return
      setDriveConnected(true)
      setHasRememberedConnection(true)
      if (!remote) {
        await write()
        // Failed initial creation must not unlock autosave against an unknown file.
        if (!fileId.current) return
      } else {
        fileId.current = remote.id
        const local = latest.current.data
        const comparison = compareProgress(
          local,
          remote.data,
          remote.id,
          latest.current.hasLocalProgress,
        )
        if (comparison.kind === 'restore') {
          uploaded.current = remote.data.updatedAt
          latest.current.replaceLocal(remote.data)
          setLastSavedAt(remote.data.updatedAt)
        } else if (comparison.kind === 'same') {
          uploaded.current = local.updatedAt
          setLastSavedAt(local.updatedAt)
        } else setConflict(comparison.conflict)
      }
      if (generation.current !== current) return
      setReady(true)
      setStatus('synced')
      setError('')
    } catch (issue) {
      if (generation.current === current) failed(issue)
    } finally {
      comparing.current = false
    }
  }, [failed, withToken, write, writes])

  useEffect(() => {
    let cancelled = false
    clearCachedDriveToken() // Server mode never stores bearer credentials in LocalStorage.
    const url = new URL(window.location.href)
    const result = url.searchParams.get('drive_auth')
    if (result) {
      url.searchParams.delete('drive_auth')
      window.history.replaceState(window.history.state, '', url.href)
    }
    void client
      .session()
      .then(async (session) => {
        if (cancelled) return
        if (session.connected) await compare()
        else setStatus('disconnected')
      })
      .catch((issue) => {
        if (!cancelled) failed(issue)
      })
    return () => {
      cancelled = true
    }
  }, [client, compare, failed])

  useEffect(() => {
    if (!ready || conflict || uploaded.current === data.updatedAt) return
    const timer = window.setTimeout(() => void write(), 1500)
    return () => window.clearTimeout(timer)
  }, [data.updatedAt, ready, conflict, write])

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible' && status === 'failed') void compare()
    }
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [compare, status])

  const authorize = () => client.connect(window.location.href)
  const disconnect = async () => {
    try {
      await client.disconnect()
      generation.current++
      fileId.current = undefined
      uploaded.current = ''
      setDriveConnected(false)
      setHasRememberedConnection(false)
      setReady(false)
      setConflict(null)
      setStatus('disconnected')
      setLastSavedAt(null)
      setError('')
    } catch (issue) {
      failed(issue)
    }
  }
  const resolveConflict = async (choice: 'local' | 'drive') => {
    if (!conflict) return
    fileId.current = conflict.driveFileId
    if (choice === 'drive') {
      uploaded.current = conflict.drive.updatedAt
      latest.current.replaceLocal(conflict.drive)
      setLastSavedAt(conflict.drive.updatedAt)
    } else await write(latest.current.data)
    setConflict(null)
  }
  const reauthorize = () => (status === 'failed' ? void compare() : authorize())
  return {
    status,
    error,
    lastSavedAt,
    conflict,
    authorize,
    reauthorize,
    disconnect,
    resolveConflict,
    clientId: getClientId(),
    hasRememberedConnection,
  }
}
