import { bindings, defineConfig } from 'cf/config'
import * as entrypoint from './src/index.ts' with { type: 'cf-worker' }

export default defineConfig(({ mode }) => ({
  accountId: 'd8d984ccb626c9a951317e18eaab57fe',
  worker: {
    name: 'bdo-ship-auth',
    workersDev: false,
    domains: mode === 'local' ? [] : ['bdo-api.katstack.dev'],
    previewUrls: false,
    observability: { enabled: false, redactQueryString: true },
    compatibilityDate: '2026-10-06',
    entrypoint,
    env: {
      FRONTEND_ORIGIN: bindings.text(
        mode === 'local' ? 'http://localhost:5173' : 'https://bdo.katstack.dev',
      ),
      OAUTH_REDIRECT_URI: bindings.text(
        mode === 'local'
          ? 'http://localhost:8787/auth/google/callback'
          : 'https://bdo-api.katstack.dev/auth/google/callback',
      ),
      GOOGLE_CLIENT_ID: bindings.text(
        '865764819056-o9i2pcvdqeb1r94fms5e4v19v24hn1ma.apps.googleusercontent.com',
      ),
      TURSO_DATABASE_URL: bindings.text('libsql://bdo-whya5448.aws-ap-northeast-1.turso.io'),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      TOKEN_ENCRYPTION_KEY: bindings.secret(),
      TURSO_AUTH_TOKEN: bindings.secret(),
    },
  },
}))
