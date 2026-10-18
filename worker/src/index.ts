import { query, type DatabaseEnv } from './db.ts'
import { decrypt, digest, encrypt, randomToken } from './security.ts'

export interface Env extends DatabaseEnv {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  TOKEN_ENCRYPTION_KEY: string
  FRONTEND_ORIGIN: string
  OAUTH_REDIRECT_URI: string
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const SESSION_AGE = 180 * 86400
const now = () => Math.floor(Date.now() / 1000)
class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
interface User {
  id: string
  refresh_token: string | null
  access_token: string | null
  access_expires: number
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function cookieName(env: Env, kind: string) {
  return `${new URL(env.OAUTH_REDIRECT_URI).protocol === 'https:' ? '__Host-' : ''}bdo_${kind}`
}
function cookie(env: Env, kind: string, value: string, age: number) {
  const secure = new URL(env.OAUTH_REDIRECT_URI).protocol === 'https:' ? '; Secure' : ''
  return `${cookieName(env, kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`
}
function readCookie(request: Request, name: string) {
  return (
    request.headers
      .get('Cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ''
  )
}
function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location })
  cookies.forEach((value) => headers.append('Set-Cookie', value))
  return new Response(null, { status: 302, headers })
}
function ready(env: Env) {
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
function returnUrl(env: Env, candidate: string | null) {
  const target = new URL(candidate || '/', env.FRONTEND_ORIGIN)
  if (target.origin !== env.FRONTEND_ORIGIN || target.username || target.password)
    throw new HttpError(400, 'invalid_return_url')
  target.searchParams.delete('drive_auth')
  return target
}
async function rateLimit(request: Request, env: Env, route: string, limit: number) {
  const time = now()
  const key = await digest(`${route}:${request.headers.get('CF-Connecting-IP') || 'local'}`)
  const rows = await query<{ hits: number }>(
    env,
    `INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN expires_at<=? THEN 1 ELSE hits+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING hits`,
    [key, time + 60, time, time],
  )
  if (rows[0].hits > limit) throw new HttpError(429, 'rate_limited')
}
async function googleToken(env: Env, fields: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...fields,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    const body = (await response.json()) as { error?: string }
    if (body.error === 'invalid_grant') throw new HttpError(401, 'reauth_required')
    throw new HttpError(502, 'google_unavailable')
  }
  const result = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }
  if (!result.access_token) throw new HttpError(502, 'google_unavailable')
  return {
    ...result,
    access_token: result.access_token,
    expires_in: Math.max(60, Math.min(result.expires_in || 3600, 86400)),
  }
}

async function start(request: Request, env: Env) {
  await rateLimit(request, env, 'oauth', 10)
  const state = randomToken(),
    binding = randomToken(),
    verifier = randomToken()
  const hash = await digest(state)
  const target = returnUrl(env, new URL(request.url).searchParams.get('returnTo'))
  // Short-lived, one-use OAuth state is tied to this browser, not just its URL.
  await query(env, 'DELETE FROM oauth_requests WHERE expires_at<=?', [now()])
  await query(env, 'DELETE FROM sessions WHERE expires_at<=?', [now()])
  await query(env, 'DELETE FROM rate_limits WHERE expires_at<=?', [now()])
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

async function callback(request: Request, env: Env) {
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

async function sessionUser(request: Request, env: Env) {
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

async function accessToken(request: Request, env: Env) {
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

async function handle(request: Request, env: Env) {
  const path = new URL(request.url).pathname
  if (path === '/healthz' && request.method === 'GET')
    return json({ status: ready(env) ? 'ready' : 'not_configured' }, ready(env) ? 200 : 503)
  if (!ready(env)) throw new HttpError(503, 'not_configured')
  if (path === '/auth/google/start' && request.method === 'GET') return start(request, env)
  if (path === '/auth/google/callback' && request.method === 'GET') return callback(request, env)
  if (!['/auth/session', '/auth/token', '/auth/logout'].includes(path))
    throw new HttpError(404, 'not_found')
  if (request.headers.get('Origin') !== env.FRONTEND_ORIGIN)
    throw new HttpError(403, 'origin_not_allowed')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (request.method === 'POST' && request.headers.get('X-BDO-CSRF') !== '1')
    throw new HttpError(403, 'csrf_required')
  if (path === '/auth/session' && request.method === 'GET') {
    await rateLimit(request, env, 'session', 60)
    try {
      await sessionUser(request, env)
      return json({ connected: true })
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) return json({ connected: false })
      throw error
    }
  }
  if (path === '/auth/token' && request.method === 'POST') return accessToken(request, env)
  if (path === '/auth/logout' && request.method === 'POST') {
    await rateLimit(request, env, 'logout', 20)
    const session = readCookie(request, cookieName(env, 'session'))
    await query(env, 'DELETE FROM sessions WHERE token_hash=?', [await digest(session)])
    // Disconnect this browser only. Other devices and Drive files are untouched.
    const response = json({ connected: false })
    response.headers.append('Set-Cookie', cookie(env, 'session', '', 0))
    return response
  }
  throw new HttpError(405, 'method_not_allowed')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response
    try {
      response = await handle(request, env)
    } catch (error) {
      response = json(
        { error: error instanceof HttpError ? error.message : 'service_unavailable' },
        error instanceof HttpError ? error.status : 503,
      )
    }
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    if (request.headers.get('Origin') === env.FRONTEND_ORIGIN) {
      response.headers.set('Access-Control-Allow-Origin', env.FRONTEND_ORIGIN)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'X-BDO-CSRF, Content-Type')
      response.headers.set('Vary', 'Origin')
    }
    if (response.status === 429 || response.status === 503) response.headers.set('Retry-After', '2')
    return response
  },
}
