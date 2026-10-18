import type { DatabaseEnv } from '../db.ts'
export interface Env extends DatabaseEnv {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  TOKEN_ENCRYPTION_KEY: string
  FRONTEND_ORIGIN: string
  OAUTH_REDIRECT_URI: string
}

export interface User {
  id: string
  refresh_token: string | null
  access_token: string | null
  access_expires: number
}
