import type { Env } from './auth/types.ts'
import { HttpError, json, ready } from './auth/http.ts'
import { start, callback } from './auth/oauth.ts'
import { sessionStatus, logout } from './auth/sessions.ts'
import { accessToken } from './auth/tokens.ts'
export type { Env } from './auth/types.ts'

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
  if (path === '/auth/session' && request.method === 'GET') return sessionStatus(request, env)
  if (path === '/auth/token' && request.method === 'POST') return accessToken(request, env)
  if (path === '/auth/logout' && request.method === 'POST') return logout(request, env)
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
