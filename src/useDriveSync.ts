import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from './types'
import {
  cacheDriveToken,
  clearCachedDriveToken,
  getCachedDriveToken,
  getClientId,
  getDriveFile,
  isDriveConnected,
  loadGoogleIdentity,
  saveDriveFile,
  setDriveConnected,
} from './drive'

export type DriveStatus = 'disconnected' | 'connecting' | 'synced' | 'failed'
export interface SyncConflict {
  local: AppData
  drive: AppData
  driveFileId: string
  newer: 'local' | 'drive'
}

export const shouldRestoreDriveOnFirstConnection = (
  hasLocalProgress: boolean,
  hasDriveFile: boolean,
) => !hasLocalProgress && hasDriveFile

export function useDriveSync(
  data: AppData,
  replaceLocal: (data: AppData) => void,
  hasLocalProgress: boolean,
) {
  const cachedToken = getCachedDriveToken()
  const [status, setStatus] = useState<DriveStatus>(cachedToken ? 'connecting' : 'disconnected')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState<SyncConflict | null>(null)
  const [hasRememberedConnection, setHasRememberedConnection] = useState(isDriveConnected)
  const token = useRef(cachedToken)
  const fileId = useRef<string | undefined>(undefined)
  const dataRef = useRef(data)
  const timer = useRef<number | undefined>(undefined)
  const hasLocalProgressRef = useRef(hasLocalProgress)
  const replaceLocalRef = useRef(replaceLocal)
  const tokenRequestInFlight = useRef(false)
  useEffect(() => {
    dataRef.current = data
  }, [data])
  useEffect(() => {
    hasLocalProgressRef.current = hasLocalProgress
  }, [hasLocalProgress])
  useEffect(() => {
    replaceLocalRef.current = replaceLocal
  }, [replaceLocal])
  const write = useCallback(async (next = dataRef.current) => {
    if (!token.current) return
    try {
      const saved = await saveDriveFile(token.current, next, fileId.current)
      fileId.current = saved.id
      setLastSavedAt(new Date().toISOString())
      setStatus('synced')
      setError('')
    } catch (e) {
      if (e instanceof Error && e.message.includes('(401)')) {
        token.current = ''
        clearCachedDriveToken()
        setStatus('disconnected')
        setError('Drive 접근 토큰이 만료되었습니다. 다음 조작에서 자동으로 재개합니다.')
        return
      }
      setStatus('failed')
      setError(e instanceof Error ? e.message : 'Drive 저장에 실패했습니다.')
    }
  }, [])
  const compare = useCallback(async () => {
    const remote = await getDriveFile(token.current)
    if (!remote) {
      await write()
      return
    }
    fileId.current = remote.id
    const local = dataRef.current
    if (shouldRestoreDriveOnFirstConnection(hasLocalProgressRef.current, true)) {
      replaceLocalRef.current(remote.data)
      setStatus('synced')
      setLastSavedAt(remote.data.updatedAt)
      return
    }
    if (remote.data.updatedAt === local.updatedAt) {
      setStatus('synced')
      setLastSavedAt(local.updatedAt)
      return
    }
    setStatus('synced')
    setConflict({
      local,
      drive: remote.data,
      driveFileId: remote.id,
      newer: Date.parse(remote.data.updatedAt) > Date.parse(local.updatedAt) ? 'drive' : 'local',
    })
  }, [write])
  const requestToken = useCallback(async () => {
    if (tokenRequestInFlight.current) return
    const clientId = getClientId()
    if (!clientId) {
      setStatus('failed')
      setError('Google OAuth Client ID를 설정하세요.')
      return
    }
    try {
      tokenRequestInFlight.current = true
      setStatus('connecting')
      await loadGoogleIdentity()
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.appdata',
        callback: (response) => {
          if (!response.access_token) {
            tokenRequestInFlight.current = false
            setStatus('failed')
            setError(response.error_description || 'Google 인증에 실패했습니다.')
            return
          }
          token.current = response.access_token
          cacheDriveToken(response.access_token, response.expires_in)
          setDriveConnected(true)
          setHasRememberedConnection(true)
          tokenRequestInFlight.current = false
          compare().catch((e) => {
            setStatus('failed')
            setError(e instanceof Error ? e.message : 'Drive 동기화에 실패했습니다.')
          })
        },
        error_callback: (issue) => {
          tokenRequestInFlight.current = false
          setStatus('failed')
          setError(issue.message || 'Google 인증 창을 닫았습니다.')
        },
      })
      client.requestAccessToken({ prompt: 'select_account' })
    } catch (e) {
      tokenRequestInFlight.current = false
      setStatus('failed')
      setError(e instanceof Error ? e.message : 'Google Identity Services 오류')
    }
  }, [compare])
  const authorize = useCallback(() => requestToken(), [requestToken])
  // OAuth token 발급은 새로고침/화면 클릭으로 절대 요청하지 않는다. 브라우저마다 빈 prompt도
  // 팝업으로 승격될 수 있기 때문이다. 유효한 캐시 토큰만 조용히 재사용한다.
  const reauthorize = authorize
  // 캐시 토큰이 남아 있으면 Drive 파일만 읽어 비교한다. GIS 인증 요청은 하지 않으므로 팝업이 없다.
  useEffect(() => {
    if (!token.current) return
    compare().catch((e) => {
      token.current = ''
      clearCachedDriveToken()
      setStatus('disconnected')
      setError(e instanceof Error ? e.message : '저장된 Drive 세션이 만료되었습니다.')
    })
  }, [compare])
  useEffect(() => {
    if (!token.current || status === 'connecting' || conflict) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => write(), 1500)
    return () => window.clearTimeout(timer.current)
  }, [data.updatedAt, status, conflict, write])
  const resolveConflict = async (choice: 'local' | 'drive') => {
    const current = conflict
    if (!current) return
    setConflict(null)
    fileId.current = current.driveFileId
    if (choice === 'drive') {
      replaceLocalRef.current(current.drive)
      setStatus('synced')
      setLastSavedAt(current.drive.updatedAt)
    } else await write(current.local)
  }
  const disconnect = () => {
    token.current = ''
    fileId.current = undefined
    clearCachedDriveToken()
    setDriveConnected(false)
    setHasRememberedConnection(false)
    setConflict(null)
    setStatus('disconnected')
    setLastSavedAt(null)
    setError('')
  }
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
