import { query } from '../db.ts'
import { decrypt, digest, encrypt, randomToken } from '../security.ts'
import type { Env, User } from './types.ts'
import {
  DRIVE_SCOPE,
  SESSION_AGE,
  now,
  HttpError,
  returnUrl,
  cookie,
  cookieName,
  readCookie,
  redirect,
} from './http.ts'
import { rateLimit } from './rateLimit.ts'
import { googleToken } from './google.ts'
import { pruneExpired } from './maintenance.ts'
export async function start(request: Request, env: Env) {
  await rateLimit(request, env, 'oauth', 10)
  const state = randomToken(),
    binding = randomToken(),
    verifier = randomToken()
  const hash = await digest(state)
  const target = returnUrl(env, new URL(request.url).searchParams.get('returnTo'))
  // Short-lived, one-use OAuth state is tied to this browser, not just its URL.
  await pruneExpired(env)
  await query(env, 'INSERT INTO oauth_requests VALUES(?,?,?,?,?)', [
    hash,
    await encrypt(verifier, env.TOKEN_ENCRYPTION_KEY, `oauth:${hash}`),
    await digest(binding),
    target.href,
    now() + 600,
  ])
  const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorize.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: `openid ${DRIVE_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent select_account',
    state,
    code_challenge: await digest(verifier),
    code_challenge_method: 'S256',
  }).toString()
  return redirect(authorize.href, [cookie(env, 'oauth', binding, 600)])
}

export async function callback(request: Request, env: Env) {
  await rateLimit(request, env, 'callback', 20)
  const params = new URL(request.url).searchParams
  const state = params.get('state') || ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new HttpError(400, 'invalid_oauth_state')
  const hash = await digest(state)
  const binding = readCookie(request, cookieName(env, 'oauth'))
  if (!binding) throw new HttpError(400, 'invalid_oauth_state')
  // DELETE RETURNING atomically prevents replay. A wrong browser cannot consume state.
  const rows = await query<{ verifier: string; return_to: string }>(
    env,
    `DELETE FROM oauth_requests
    WHERE state_hash=? AND binding_hash=? AND expires_at>? RETURNING verifier,return_to`,
    [hash, await digest(binding), now()],
  )
  const pending = rows[0]
  if (!pending) throw new HttpError(400, 'invalid_oauth_state')
  const target = returnUrl(env, pending.return_to)
  const clear = cookie(env, 'oauth', '', 0)
  try {
    if (params.has('error') || !params.get('code')) throw new HttpError(400, 'authorization_denied')
    const result = await googleToken(env, {
      grant_type: 'authorization_code',
      code: params.get('code')!,
      redirect_uri: env.OAUTH_REDIRECT_URI,
      code_verifier: await decrypt(pending.verifier, env.TOKEN_ENCRYPTION_KEY, `oauth:${hash}`),
    })
    if (!result.scope?.split(' ').includes(DRIVE_SCOPE))
      throw new HttpError(400, 'drive_permission_required')
    // Get identity directly from Google's authenticated TLS endpoint; never trust an unverified ID token.
    const identity = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${result.access_token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!identity.ok) throw new HttpError(502, 'google_unavailable')
    const { sub } = (await identity.json()) as { sub?: string }
    if (!sub || !/^[A-Za-z0-9_-]{1,255}$/.test(sub)) throw new HttpError(502, 'invalid_identity')
    const existing = (await query<User>(env, 'SELECT * FROM users WHERE id=?', [sub]))[0]
    const refresh = result.refresh_token
      ? await encrypt(result.refresh_token, env.TOKEN_ENCRYPTION_KEY, `refresh:${sub}`)
      : existing?.refresh_token
    if (!refresh) throw new HttpError(401, 'offline_permission_required')
    await query(
      env,
      `INSERT INTO users(id,refresh_token,access_token,access_expires,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET refresh_token=excluded.refresh_token,access_token=excluded.access_token,
      access_expires=excluded.access_expires,refresh_lock_until=0,updated_at=excluded.updated_at`,
      [
        sub,
        refresh,
        await encrypt(result.access_token, env.TOKEN_ENCRYPTION_KEY, `access:${sub}`),
        now() + result.expires_in,
        now(),
      ],
    )
    const session = randomToken()
    await query(env, 'INSERT INTO sessions VALUES(?,?,?)', [
      await digest(session),
      sub,
      now() + SESSION_AGE,
    ])
    target.searchParams.set('drive_auth', 'connected')
    return redirect(target.href, [clear, cookie(env, 'session', session, SESSION_AGE)])
  } catch (error) {
    // Never put Google errors, codes or tokens into logs or return URLs.
    target.searchParams.set(
      'drive_auth',
      error instanceof HttpError ? error.message : 'connection_failed',
    )
    return redirect(target.href, [clear])
  }
}
