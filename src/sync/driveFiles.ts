import type { AppData } from '../types'
import { normalize } from '../storage'
const FILE_NAME = 'bdo-ship-materials.json'
interface DriveFile {
  id: string
  modifiedTime?: string
}
function parseFile(value: unknown): DriveFile {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !value.id.trim()
  )
    throw new Error('Drive 파일 응답이 올바르지 않습니다.')
  return { id: value.id }
}
export class DriveRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Google Drive 요청 실패 (${status})`)
  }
}
export async function getDriveFile(token: string): Promise<{ id: string; data: AppData } | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: 'files(id,modifiedTime)',
    pageSize: '1',
  })
  const list = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, token)
  if (!list || typeof list !== 'object' || !('files' in list) || !Array.isArray(list.files))
    throw new Error('Drive 파일 목록 응답이 올바르지 않습니다.')
  if (!list.files.length) return null
  const file = parseFile(list.files[0])
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  if (!response.ok) throw new DriveRequestError(response.status)
  return { id: file.id, data: normalize(await response.json()) }
}
export async function saveDriveFile(token: string, data: AppData, fileId?: string) {
  const boundary = `bdo-${crypto.randomUUID()}`
  const metadata = fileId
    ? {}
    : { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' }
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  return parseFile(
    await driveFetch(url, token, {
      method: fileId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }),
  )
}
async function driveFetch(url: string, token: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  })
  if (!response.ok) {
    throw new DriveRequestError(response.status)
  }
  return response.json()
}
