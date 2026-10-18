import type { Env } from './types.ts'
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
export const SESSION_AGE = 180 * 86400
export const now = () => Math.floor(Date.now() / 1000)
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
export function cookieName(env: Env, kind: string) {
  return `${new URL(env.OAUTH_REDIRECT_URI).protocol === 'https:' ? '__Host-' : ''}bdo_${kind}`
}
export function cookie(env: Env, kind: string, value: string, age: number) {
  const secure = new URL(env.OAUTH_REDIRECT_URI).protocol === 'https:' ? '; Secure' : ''
  return `${cookieName(env, kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`
}
export function readCookie(request: Request, name: string) {
  return (
    request.headers
      .get('Cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ''
  )
}
export function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location })
  cookies.forEach((value) => headers.append('Set-Cookie', value))
  return new Response(null, { status: 302, headers })
}
export function ready(env: Env) {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.TOKEN_ENCRYPTION_KEY &&
    env.TURSO_AUTH_TOKEN &&
    env.TURSO_DATABASE_URL &&
    env.FRONTEND_ORIGIN &&
    env.OAUTH_REDIRECT_URI,
  )
}
export function returnUrl(env: Env, candidate: string | null) {
  const target = new URL(candidate || '/', env.FRONTEND_ORIGIN)
  if (target.origin !== env.FRONTEND_ORIGIN || target.username || target.password)
    throw new HttpError(400, 'invalid_return_url')
  target.searchParams.delete('drive_auth')
  return target
}
