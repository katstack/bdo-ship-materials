import { query } from '../db.ts'
import { decrypt, encrypt } from '../security.ts'
import type { Env } from './types.ts'
import { now, HttpError, json } from './http.ts'
import { rateLimit } from './rateLimit.ts'
import { googleToken } from './google.ts'
import { sessionUser } from './sessions.ts'
export async function accessToken(request: Request, env: Env) {
  await rateLimit(request, env, 'token', 60)
  const user = await sessionUser(request, env)
  if (
    user.access_token &&
    user.access_expires > now() + 60 &&
    new URL(request.url).searchParams.get('refresh') !== '1'
  )
    return json({
      accessToken: await decrypt(user.access_token, env.TOKEN_ENCRYPTION_KEY, `access:${user.id}`),
      expiresAt: user.access_expires * 1000,
    })
  const lease = now() + 15
  const locked = await query<{ id: string }>(
    env,
    'UPDATE users SET refresh_lock_until=? WHERE id=? AND refresh_lock_until<=? RETURNING id',
    [lease, user.id, now()],
  )
  if (!locked.length) throw new HttpError(503, 'refresh_in_progress')
  try {
    const result = await googleToken(env, {
      grant_type: 'refresh_token',
      refresh_token: await decrypt(
        user.refresh_token!,
        env.TOKEN_ENCRYPTION_KEY,
        `refresh:${user.id}`,
      ),
    })
    const expiry = now() + result.expires_in
    await query(
      env,
      'UPDATE users SET access_token=?,access_expires=?,refresh_token=?,updated_at=? WHERE id=?',
      [
        await encrypt(result.access_token, env.TOKEN_ENCRYPTION_KEY, `access:${user.id}`),
        expiry,
        result.refresh_token
          ? await encrypt(result.refresh_token, env.TOKEN_ENCRYPTION_KEY, `refresh:${user.id}`)
          : user.refresh_token,
        now(),
        user.id,
      ],
    )
    return json({ accessToken: result.access_token, expiresAt: expiry * 1000 })
  } catch (error) {
    if (error instanceof HttpError && error.status === 401)
      await query(
        env,
        'UPDATE users SET refresh_token=NULL,access_token=NULL,access_expires=0 WHERE id=?',
        [user.id],
      )
    throw error
  } finally {
    await query(env, 'UPDATE users SET refresh_lock_until=0 WHERE id=? AND refresh_lock_until=?', [
      user.id,
      lease,
    ])
  }
}
