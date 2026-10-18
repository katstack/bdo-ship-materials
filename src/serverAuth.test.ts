import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServerAuthClient, ServerAuthError } from './serverAuth'

afterEach(() => vi.useRealTimers())

describe('server-backed Drive authorization', () => {
  it('never resurrects a pending token after this browser disconnects', async () => {
    let release!: (response: Response) => void
    let first = true
    const client = createServerAuthClient('https://api.example', async (url) => {
      if (String(url).endsWith('/auth/logout')) return Response.json({ connected: false })
      if (first) {
        first = false
        return new Promise<Response>((resolve) => {
          release = resolve
        })
      }
      return Response.json({ accessToken: 'new-session', expiresAt: Date.now() + 3600_000 })
    })
    const pending = client.token()
    const rejected = expect(pending).rejects.toThrow('연결 상태가 변경')
    await client.disconnect()
    release(Response.json({ accessToken: 'old-session', expiresAt: Date.now() + 3600_000 }))
    await rejected
    expect(await client.token()).toBe('new-session')
  })
  it.each([null, {}, { connected: 'false' }, { connected: 1 }])(
    'validates session payloads at runtime: %j',
    async (body) => {
      const client = createServerAuthClient('https://api.example', async () => Response.json(body))
      await expect(client.session()).rejects.toThrow('세션 응답')
    },
  )
  it.each([
    null,
    {},
    { accessToken: 42, expiresAt: Date.now() + 3600_000 },
    { accessToken: 'token', expiresAt: 'future' },
  ])('validates token payloads at runtime: %j', async (body) => {
    const client = createServerAuthClient('https://api.example', async () => Response.json(body))
    await expect(client.token()).rejects.toThrow('인증 응답')
  })
  it('uses credentials and a CSRF header, caches tokens only until near expiry', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ accessToken: 'short-lived', expiresAt: Date.now() + 3600_000 }),
    )
    const client = createServerAuthClient('https://api.example', fetcher)
    expect(await client.token()).toBe('short-lived')
    expect(await client.token()).toBe('short-lived')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]).toEqual([
      'https://api.example/auth/token',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'X-BDO-CSRF': '1' },
      }),
    ])
    vi.advanceTimersByTime(3600_000)
    await client.token()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent requests and supports a forced refresh after a Drive 401', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ accessToken: 'token', expiresAt: Date.now() + 3600_000 }),
    )
    const client = createServerAuthClient('https://api.example', fetcher)
    await Promise.all([client.token(), client.token(), client.token()])
    expect(fetcher).toHaveBeenCalledTimes(1)
    await client.token(true)
    expect(fetcher.mock.calls[1][0]).toBe('https://api.example/auth/token?refresh=1')
  })

  it('reports lost permission without starting OAuth or a popup', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ error: 'reauth_required' }, { status: 401 }),
    )
    const client = createServerAuthClient('https://api.example', fetcher)
    await expect(client.token()).rejects.toMatchObject({ status: 401 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('retries a concurrent server refresh with bounded backoff', async () => {
    vi.useFakeTimers()
    let calls = 0
    const client = createServerAuthClient('https://api.example', async () =>
      ++calls < 3
        ? Response.json({ error: 'refresh_in_progress' }, { status: 503 })
        : Response.json({ accessToken: 'renewed', expiresAt: Date.now() + 3600_000 }),
    )
    const promise = client.token()
    await vi.runAllTimersAsync()
    expect(await promise).toBe('renewed')
    expect(calls).toBe(3)
  })

  it('disconnects through the server and invalidates the in-memory cache', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ accessToken: 'token', expiresAt: Date.now() + 3600_000 }),
    )
    const client = createServerAuthClient('https://api.example', fetcher)
    await client.token()
    await client.disconnect()
    expect(fetcher.mock.calls[1][0]).toBe('https://api.example/auth/logout')
    await client.token()
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('rejects invalid server responses and does not expose server error details', async () => {
    const client = createServerAuthClient('https://api.example', async () =>
      Response.json({ accessToken: 'bad', expiresAt: 0 }),
    )
    await expect(client.token()).rejects.toThrow('인증 응답')
    const denied = createServerAuthClient(
      'https://api.example',
      async () => new Response('secret details', { status: 403 }),
    )
    await expect(denied.token()).rejects.toBeInstanceOf(ServerAuthError)
    await expect(denied.token()).rejects.not.toThrow('secret details')
  })
})
