import { query } from '../db.ts'
import { digest } from '../security.ts'
import type { Env } from './types.ts'
import { now, HttpError } from './http.ts'
export async function rateLimit(request: Request, env: Env, route: string, limit: number) {
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
