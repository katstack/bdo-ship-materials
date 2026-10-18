import type { Env } from './types.ts'
import { HttpError } from './http.ts'
export async function googleToken(env: Env, fields: Record<string, string>) {
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
