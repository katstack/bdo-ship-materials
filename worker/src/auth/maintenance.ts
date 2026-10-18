import { query } from '../db.ts'
import type { Env } from './types.ts'
import { now } from './http.ts'

/** Opportunistic cleanup never touches user grants or live browser sessions. */
export async function pruneExpired(env: Env) {
  const expiry = now()
  await query(env, 'DELETE FROM oauth_requests WHERE expires_at<=?', [expiry])
  await query(env, 'DELETE FROM sessions WHERE expires_at<=?', [expiry])
  await query(env, 'DELETE FROM rate_limits WHERE expires_at<=?', [expiry])
}
