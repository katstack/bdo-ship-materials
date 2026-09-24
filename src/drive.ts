import type { AppData } from './types'
import { normalize } from './storage'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE_NAME = 'bdo-ship-materials.json'
const GIS_URL = 'https://accounts.google.com/gsi/client'

declare global {
  interface Window { google?: { accounts: { oauth2: { initTokenClient: (options: GoogleTokenClientConfig) => GoogleTokenClient } } } }
}
interface GoogleTokenClientConfig { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void; error_callback?: (error: { type?: string; message?: string }) => void }
interface GoogleTokenClient { requestAccessToken: (options?: { prompt?: string }) => void }
interface GoogleTokenResponse { access_token?: string; error?: string; error_description?: string; expires_in?: number }
interface DriveFile { id: string; modifiedTime?: string }

export function getClientId() { return localStorage.getItem('bdo-drive-client-id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || '' }
export function setClientId(clientId: string) { localStorage.setItem('bdo-drive-client-id', clientId.trim()) }
export function isDriveConnected() { return localStorage.getItem('bdo-drive-connected') === 'true' }
export function setDriveConnected(connected: boolean) { localStorage.setItem('bdo-drive-connected', String(connected)) }

export async function loadGoogleIdentity() {
  if (window.google?.accounts.oauth2) return
  await new Promise<void>((resolve, reject) => { const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_URL}"]`); if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Google Identity Services를 불러오지 못했습니다.')), { once: true }); return } const script = document.createElement('script'); script.src = GIS_URL; script.async = true; script.onload = () => resolve(); script.onerror = () => reject(new Error('Google Identity Services를 불러오지 못했습니다.')); document.head.append(script) })
  if (!window.google?.accounts.oauth2) throw new Error('Google Identity Services를 초기화하지 못했습니다.')
}
export async function getDriveFile(token: string): Promise<{ id: string; data: AppData } | null> {
  const params = new URLSearchParams({ spaces: 'appDataFolder', q: `name = '${FILE_NAME}' and trashed = false`, fields: 'files(id,modifiedTime)', pageSize: '1' })
  const list = await driveFetch<{ files?: DriveFile[] }>(`https://www.googleapis.com/drive/v3/files?${params}`, token)
  const file = list.files?.[0]; if (!file) return null
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`Drive 데이터를 읽지 못했습니다. (${response.status})`)
  return { id: file.id, data: normalize(await response.json()) }
}
export async function saveDriveFile(token: string, data: AppData, fileId?: string) {
  const boundary = `bdo-${crypto.randomUUID()}`
  const metadata = fileId ? {} : { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' }
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`
  const url = fileId ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  return driveFetch<DriveFile>(url, token, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
}
async function driveFetch<T>(url: string, token: string, init: RequestInit = {}) { const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } }); if (!response.ok) { const detail = await response.text(); throw new Error(`Google Drive 요청 실패 (${response.status})${detail ? `: ${detail.slice(0, 120)}` : ''}`) } return response.json() as Promise<T> }
