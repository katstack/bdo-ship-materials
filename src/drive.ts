export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const GIS_URL = 'https://accounts.google.com/gsi/client'
const TOKEN_CACHE_KEY = 'bdo-drive-access-token:v1'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: { initTokenClient: (options: GoogleTokenClientConfig) => GoogleTokenClient }
        id: {
          initialize: (options: GoogleOneTapConfig) => void
          prompt: () => void
          cancel: () => void
        }
      }
    }
  }
}
interface GoogleTokenClientConfig {
  client_id: string
  scope: string
  callback: (response: GoogleTokenResponse) => void
  error_callback?: (error: { type?: string; message?: string }) => void
}
interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}
interface GoogleTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
  expires_in?: number
}
interface GoogleOneTapConfig {
  client_id: string
  callback: (response: { credential?: string }) => void
  cancel_on_tap_outside?: boolean
  context?: 'signin'
}

// OAuth client IDs are public identifiers, not secrets. Never add a client secret here.
const GOOGLE_CLIENT_ID = '865764819056-o9i2pcvdqeb1r94fms5e4v19v24hn1ma.apps.googleusercontent.com'
export function getClientId() {
  return GOOGLE_CLIENT_ID
}
export function isDriveConnected() {
  return localStorage.getItem('bdo-drive-connected') === 'true'
}
export function setDriveConnected(connected: boolean) {
  localStorage.setItem('bdo-drive-connected', String(connected))
}
// GIS 토큰은 짧게 유효한 bearer credential이다. 유효 시간 안에 새로고침해도 GIS를 다시
// 호출하지 않도록 보관하며, 만료 30초 전에는 폐기한다. 장기 갱신 토큰·비밀값은 저장하지 않는다.
export function getCachedDriveToken() {
  try {
    const cached = JSON.parse(localStorage.getItem(TOKEN_CACHE_KEY) || 'null') as {
      accessToken?: string
      expiresAt?: number
    } | null
    if (
      cached?.accessToken &&
      typeof cached.expiresAt === 'number' &&
      cached.expiresAt > Date.now() + 30_000
    )
      return cached.accessToken
    localStorage.removeItem(TOKEN_CACHE_KEY)
  } catch {
    localStorage.removeItem(TOKEN_CACHE_KEY)
  }
  return ''
}
export function cacheDriveToken(accessToken: string, expiresIn?: number) {
  const lifetime = Math.max(60, Number(expiresIn) || 3600)
  localStorage.setItem(
    TOKEN_CACHE_KEY,
    JSON.stringify({ accessToken, expiresAt: Date.now() + lifetime * 1000 }),
  )
}
export function clearCachedDriveToken() {
  localStorage.removeItem(TOKEN_CACHE_KEY)
}

export async function loadGoogleIdentity() {
  if (window.google?.accounts.oauth2 && window.google.accounts.id) return
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Google Identity Services를 불러오지 못했습니다.')),
        { once: true },
      )
      return
    }
    const script = document.createElement('script')
    script.src = GIS_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services를 불러오지 못했습니다.'))
    document.head.append(script)
  })
  if (!window.google?.accounts.oauth2 || !window.google.accounts.id)
    throw new Error('Google Identity Services를 초기화하지 못했습니다.')
}

/**
 * Google One Tap은 새 창 OAuth가 아니라 페이지 우측 상단의 Google 카드다.
 * ID credential은 저장하지 않고, 사용자가 '계속'을 누른 직후 Drive access token을 조용히 갱신하는
 * 신호로만 사용한다.
 */
export function promptGoogleOneTap(onContinue: () => void) {
  if (!window.google?.accounts.id) throw new Error('Google One Tap을 초기화하지 못했습니다.')
  window.google.accounts.id.initialize({
    client_id: getClientId(),
    callback: (response) => {
      if (response.credential) onContinue()
    },
    cancel_on_tap_outside: true,
    context: 'signin',
  })
  window.google.accounts.id.prompt()
}

export function cancelGoogleOneTap() {
  window.google?.accounts.id?.cancel()
}
export { getDriveFile, saveDriveFile, DriveRequestError } from './sync/driveFiles'
