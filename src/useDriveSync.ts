import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from './types'
import { getClientId, getDriveFile, isDriveConnected, loadGoogleIdentity, saveDriveFile, setDriveConnected } from './drive'

export type DriveStatus = 'disconnected' | 'connecting' | 'synced' | 'failed'
export interface SyncConflict { local: AppData; drive: AppData; driveFileId: string; newer: 'local' | 'drive' }

export function useDriveSync(data: AppData, replaceLocal: (data: AppData) => void) {
  const [status, setStatus] = useState<DriveStatus>(isDriveConnected() ? 'connecting' : 'disconnected')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null); const [error, setError] = useState(''); const [conflict, setConflict] = useState<SyncConflict | null>(null)
  const token = useRef(''); const fileId = useRef<string | undefined>(undefined); const dataRef = useRef(data); const timer = useRef<number | undefined>(undefined); dataRef.current = data
  const write = useCallback(async (next = dataRef.current) => { if (!token.current) return; try { const saved = await saveDriveFile(token.current, next, fileId.current); fileId.current = saved.id; setLastSavedAt(new Date().toISOString()); setStatus('synced'); setError('') } catch (e) { setStatus('failed'); setError(e instanceof Error ? e.message : 'Drive 저장에 실패했습니다.') } }, [])
  const compare = useCallback(async () => { const remote = await getDriveFile(token.current); if (!remote) { await write(); return } fileId.current = remote.id; const local = dataRef.current; if (remote.data.updatedAt === local.updatedAt) { setStatus('synced'); setLastSavedAt(local.updatedAt); return } setConflict({ local, drive: remote.data, driveFileId: remote.id, newer: Date.parse(remote.data.updatedAt) > Date.parse(local.updatedAt) ? 'drive' : 'local' }) }, [write])
  const authorize = useCallback(async (interactive: boolean) => { const clientId = getClientId(); if (!clientId) { setStatus('failed'); setError('Google OAuth Client ID를 설정하세요.'); return } try { setStatus('connecting'); await loadGoogleIdentity(); const client = window.google!.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'https://www.googleapis.com/auth/drive.appdata', callback: response => { if (!response.access_token) { setStatus('failed'); setError(response.error_description || 'Google 인증에 실패했습니다.'); return } token.current = response.access_token; setDriveConnected(true); compare().catch(e => { setStatus('failed'); setError(e instanceof Error ? e.message : 'Drive 동기화에 실패했습니다.') }) }, error_callback: issue => { setStatus('failed'); setError(issue.message || 'Google 인증 창을 닫았습니다.') } }); client.requestAccessToken({ prompt: interactive ? 'select_account' : '' }) } catch (e) { setStatus('failed'); setError(e instanceof Error ? e.message : 'Google Identity Services 오류') } }, [compare])
  useEffect(() => { if (isDriveConnected()) authorize(false) }, [authorize])
  useEffect(() => { if (!token.current || status === 'connecting' || conflict) return; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => write(), 1500); return () => window.clearTimeout(timer.current) }, [data.updatedAt, status, conflict, write])
  const resolveConflict = async (choice: 'local' | 'drive') => { const current = conflict; if (!current) return; setConflict(null); fileId.current = current.driveFileId; if (choice === 'drive') { replaceLocal(current.drive); setStatus('synced'); setLastSavedAt(current.drive.updatedAt) } else await write(current.local) }
  const disconnect = () => { token.current = ''; fileId.current = undefined; setDriveConnected(false); setConflict(null); setStatus('disconnected'); setLastSavedAt(null); setError('') }
  return { status, error, lastSavedAt, conflict, authorize: () => authorize(true), disconnect, resolveConflict, clientId: getClientId() }
}
