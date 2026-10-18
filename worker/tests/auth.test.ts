import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import worker, { type Env } from '../src/index.ts'
import { decrypt, digest, encrypt, randomToken } from '../src/security.ts'

const origin = 'https://bdo.katstack.dev'
const api = 'https://bdo-api.katstack.dev'
const scope = 'https://www.googleapis.com/auth/drive.appdata'
const env: Env = {
  FRONTEND_ORIGIN: origin,
  OAUTH_REDIRECT_URI: `${api}/auth/google/callback`,
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  TURSO_DATABASE_URL: 'libsql://unit-test.turso.io',
  TURSO_AUTH_TOKEN: 'test-db-token',
  TOKEN_ENCRYPTION_KEY: randomToken(),
}
let db: DatabaseSync
let originalFetch: typeof fetch
let identity: string
let refreshes: number
let revoked: boolean
let databaseDown: boolean
let holdRefresh: Promise<void> | undefined
let verifier: string

function call(path: string, cookie = '', method = 'GET', requestOrigin = origin, csrf = '1') {
  return worker.fetch(
    new Request(`${api}${path}`, {
      method,
      headers: {
        Origin: requestOrigin,
        Cookie: cookie,
        'X-BDO-CSRF': csrf,
        'CF-Connecting-IP': '192.0.2.1',
      },
    }),
    env,
  )
}
async function begin() {
  const response = await call(
    `/auth/google/start?returnTo=${encodeURIComponent(`${origin}/?view=materials#barter`)}`,
  )
  assert.equal(response.status, 302)
  const authorize = new URL(response.headers.get('Location')!)
  const binding = response.headers.getSetCookie()[0].split(';')[0]
  const callback = `/auth/google/callback?state=${authorize.searchParams.get('state')}&code=example-code`
  return { authorize, binding, callback }
}
async function login() {
  const started = await begin()
  const response = await call(started.callback, started.binding)
  assert.equal(response.status, 302)
  assert.equal(
    new URL(response.headers.get('Location')!).searchParams.get('drive_auth'),
    'connected',
  )
  const session = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('__Host-bdo_session='))!
  assert.ok(
    session.includes('HttpOnly') && session.includes('Secure') && session.includes('SameSite=Lax'),
  )
  return session.split(';')[0]
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/001_auth.sql', import.meta.url), 'utf8'))
  identity = 'google-user-a'
  refreshes = 0
  revoked = false
  databaseDown = false
  holdRefresh = undefined
  verifier = ''
  originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('unit-test.turso.io')) {
      if (databaseDown) throw new Error('internal credential must not be exposed')
      const { requests } = JSON.parse(String(init?.body))
      const { sql, args } = requests[0].stmt
      const statement = db.prepare(sql)
      const rows = statement.all(
        ...args.map((arg: { type: string; value?: string }) =>
          arg.type === 'null' ? null : arg.type === 'integer' ? Number(arg.value) : arg.value,
        ),
      )
      const cols = statement.columns().map((column) => ({ name: column.name }))
      return Response.json({
        results: [
          {
            type: 'ok',
            response: {
              type: 'execute',
              result: {
                cols,
                rows: rows.map((row) =>
                  cols.map((col) => {
                    const value = row[col.name]
                    return value === null
                      ? { type: 'null' }
                      : {
                          type: typeof value === 'number' ? 'integer' : 'text',
                          value: String(value),
                        }
                  }),
                ),
              },
            },
          },
          { type: 'ok', response: { type: 'close' } },
        ],
      })
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      const fields = new URLSearchParams(String(init?.body))
      assert.equal(fields.get('client_secret'), env.GOOGLE_CLIENT_SECRET)
      if (fields.get('grant_type') === 'refresh_token') {
        refreshes++
        if (holdRefresh) await holdRefresh
        if (revoked) return Response.json({ error: 'invalid_grant' }, { status: 400 })
        return Response.json({ access_token: 'renewed-access', expires_in: 3600 })
      }
      verifier = fields.get('code_verifier')!
      assert.equal(fields.get('redirect_uri'), env.OAUTH_REDIRECT_URI)
      return Response.json({
        access_token: 'initial-access',
        refresh_token: 'private-refresh',
        expires_in: 3600,
        scope: `openid ${scope}`,
      })
    }
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo')
      return Response.json({ sub: identity })
    throw new Error(`Unexpected mock destination: ${url}`)
  }
})
afterEach(() => {
  globalThis.fetch = originalFetch
  db.close()
})

describe('Google Drive authorization worker', () => {
  it('requests only appData and identity, binds one-use state, and uses S256 PKCE', async () => {
    const started = await begin()
    assert.equal(started.authorize.searchParams.get('scope'), `openid ${scope}`)
    assert.equal(started.authorize.searchParams.get('access_type'), 'offline')
    assert.equal(started.authorize.searchParams.get('code_challenge_method'), 'S256')
    const wrongBrowser = await call(started.callback, '__Host-bdo_oauth=wrong')
    assert.equal(wrongBrowser.status, 400)
    const connected = await call(started.callback, started.binding)
    assert.equal(connected.status, 302)
    assert.equal(await digest(verifier), started.authorize.searchParams.get('code_challenge'))
    assert.equal((await call(started.callback, started.binding)).status, 400)
  })

  it('encrypts Google credentials, hashes sessions and preserves the return screen', async () => {
    const started = await begin()
    const response = await call(started.callback, started.binding)
    const target = new URL(response.headers.get('Location')!)
    assert.equal(target.hash, '#barter')
    assert.equal(target.searchParams.get('view'), 'materials')
    const user = db.prepare('SELECT * FROM users').get()!
    assert.notEqual(user.refresh_token, 'private-refresh')
    assert.notEqual(user.access_token, 'initial-access')
    assert.equal(
      await decrypt(String(user.refresh_token), env.TOKEN_ENCRYPTION_KEY, `refresh:${identity}`),
      'private-refresh',
    )
    const cookies = response.headers.getSetCookie().join(';')
    assert.ok(
      !cookies.includes(String(db.prepare('SELECT token_hash FROM sessions').get()!.token_hash)),
    )
  })

  it('restores a browser session and renews expired Drive tokens without a Google redirect', async () => {
    const session = await login()
    assert.deepEqual(await (await call('/auth/session', session)).json(), { connected: true })
    assert.equal(
      (await (await call('/auth/token', session, 'POST')).json()).accessToken,
      'initial-access',
    )
    assert.equal(refreshes, 0)
    db.exec('UPDATE users SET access_expires=0')
    const response = await call('/auth/token', session, 'POST')
    assert.equal(response.status, 200)
    assert.equal((await response.json()).accessToken, 'renewed-access')
    assert.equal(response.headers.get('Location'), null)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(refreshes, 1)
  })

  it('rejects untrusted origins, missing CSRF headers and open redirects', async () => {
    const session = await login()
    assert.equal(
      (await call('/auth/token', session, 'POST', 'https://attacker.example')).status,
      403,
    )
    assert.equal((await call('/auth/token', session, 'POST', origin, '')).status, 403)
    assert.equal((await call('/auth/google/start?returnTo=https://attacker.example')).status, 400)
    const preflight = await call('/auth/token', '', 'OPTIONS')
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin)
    assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), 'true')
    const evil = await call('/auth/token', '', 'OPTIONS', 'https://attacker.example')
    assert.equal(evil.headers.get('Access-Control-Allow-Origin'), null)
  })

  it('disconnects only the current browser and retains other devices', async () => {
    const first = await login(),
      second = await login()
    assert.equal((await call('/auth/logout', first, 'POST')).status, 200)
    assert.deepEqual(await (await call('/auth/session', first)).json(), { connected: false })
    assert.deepEqual(await (await call('/auth/session', second)).json(), { connected: true })
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get()!.count, 1)
  })

  it('rejects expired state and expired browser sessions', async () => {
    const started = await begin()
    db.exec('UPDATE oauth_requests SET expires_at=0')
    assert.equal((await call(started.callback, started.binding)).status, 400)
    const session = await login()
    db.exec('UPDATE sessions SET expires_at=0')
    assert.equal((await call('/auth/token', session, 'POST')).status, 401)
  })

  it('requires reconnection after Google revokes the refresh token', async () => {
    const session = await login()
    db.exec('UPDATE users SET access_expires=0')
    revoked = true
    const response = await call('/auth/token', session, 'POST')
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'reauth_required' })
    assert.equal(db.prepare('SELECT refresh_token FROM users').get()!.refresh_token, null)
  })

  it('does not run concurrent Google refreshes for the same user', async () => {
    const session = await login()
    db.exec('UPDATE users SET access_expires=0')
    let release!: () => void
    holdRefresh = new Promise((resolve) => {
      release = resolve
    })
    const first = call('/auth/token', session, 'POST')
    while (!refreshes) await new Promise((resolve) => setTimeout(resolve, 1))
    const second = await call('/auth/token', session, 'POST')
    assert.equal(second.status, 503)
    assert.equal(second.headers.get('Retry-After'), '2')
    release()
    assert.equal((await first).status, 200)
    assert.equal(refreshes, 1)
  })

  it('rate limits authorization attempts', async () => {
    for (let i = 0; i < 10; i++) assert.equal((await call('/auth/google/start')).status, 302)
    assert.equal((await call('/auth/google/start')).status, 429)
  })

  it('prunes expired records without deleting live sessions or user grants', async () => {
    const session = await login()
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('expired-session', identity, 0)
    await begin()
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE expires_at=0').get()!.count,
      0,
    )
    assert.deepEqual(await (await call('/auth/session', session)).json(), { connected: true })
    assert.ok(db.prepare('SELECT refresh_token FROM users').get()!.refresh_token)
  })

  it('fails closed on missing configuration or DB errors without leaking details', async () => {
    assert.equal(
      (await worker.fetch(new Request(`${api}/healthz`), { ...env, GOOGLE_CLIENT_SECRET: '' }))
        .status,
      503,
    )
    databaseDown = true
    const response = await call('/auth/session')
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'service_unavailable' })
  })

  it('authenticates ciphertext against its record and purpose', async () => {
    const value = await encrypt('refresh-secret', env.TOKEN_ENCRYPTION_KEY, 'refresh:user-a')
    assert.equal(await decrypt(value, env.TOKEN_ENCRYPTION_KEY, 'refresh:user-a'), 'refresh-secret')
    await assert.rejects(decrypt(value, env.TOKEN_ENCRYPTION_KEY, 'refresh:user-b'))
    await assert.rejects(decrypt(value, env.TOKEN_ENCRYPTION_KEY, 'access:user-a'))
  })
})
