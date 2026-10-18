import { query } from '../db.ts'
import { digest } from '../security.ts'
import type { Env, User } from './types.ts'
import { now, HttpError, readCookie, cookieName, cookie, json } from './http.ts'
import { rateLimit } from './rateLimit.ts'
export async function sessionUser(request: Request, env: Env) {
  const session = readCookie(request, cookieName(env, 'session'))
  if (!/^[A-Za-z0-9_-]{43}$/.test(session)) throw new HttpError(401, 'reauth_required')
  const users = await query<User>(
    env,
    `SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id
    WHERE s.token_hash=? AND s.expires_at>?`,
    [await digest(session), now()],
  )
  if (!users[0]?.refresh_token) throw new HttpError(401, 'reauth_required')
  return users[0]
}

export async function sessionStatus(request: Request, env: Env) {
  await rateLimit(request, env, 'session', 60)
  try {
    await sessionUser(request, env)
    return json({ connected: true })
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return json({ connected: false })
    throw error
  }
}
export async function logout(request: Request, env: Env) {
  await rateLimit(request, env, 'logout', 20)
  const session = readCookie(request, cookieName(env, 'session'))
  await query(env, 'DELETE FROM sessions WHERE token_hash=?', [await digest(session)])
  // Disconnect this browser only. Other devices and Drive files are untouched.
  const response = json({ connected: false })
  response.headers.append('Set-Cookie', cookie(env, 'session', '', 0))
  return response
}
