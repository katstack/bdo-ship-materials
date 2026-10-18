export const SERVER_AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || '').replace(/\/$/, '')

export class ServerAuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function createServerAuthClient(baseUrl: string, fetcher: typeof fetch = fetch) {
  let cached: { accessToken: string; expiresAt: number } | undefined
  let inFlight: Promise<string> | undefined
  let generation = 0

  async function request(path: string, method = 'GET'): Promise<unknown> {
    const response = await fetcher(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: method === 'POST' ? { 'X-BDO-CSRF': '1' } : undefined,
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      if (response.status === 401)
        throw new ServerAuthError(
          401,
          'Google Drive 권한이 만료되거나 취소되었습니다. 다시 연결해 주세요.',
        )
      throw new ServerAuthError(
        response.status,
        response.status === 429
          ? '요청이 많습니다. 잠시 후 다시 시도합니다.'
          : '동기화 서버에 연결하지 못했습니다. 로컬 저장은 유지됩니다.',
      )
    }
    return response.json()
  }

  function clear() {
    generation++
    cached = undefined
    inFlight = undefined
  }

  return {
    async session(): Promise<{ connected: boolean }> {
      const result = await request('/auth/session')
      if (
        !result ||
        typeof result !== 'object' ||
        !('connected' in result) ||
        typeof result.connected !== 'boolean'
      )
        throw new Error('동기화 서버의 세션 응답이 올바르지 않습니다.')
      return { connected: result.connected }
    },
    clear,
    token(force = false): Promise<string> {
      if (!force && cached && cached.expiresAt > Date.now() + 60_000)
        return Promise.resolve(cached.accessToken)
      if (inFlight) return inFlight
      const current = generation
      inFlight = (async () => {
        for (let attempt = 0; ; attempt++) {
          try {
            const result = await request(`/auth/token${force ? '?refresh=1' : ''}`, 'POST')
            if (generation !== current) throw new Error('연결 상태가 변경되었습니다.')
            if (
              !result ||
              typeof result !== 'object' ||
              !('accessToken' in result) ||
              typeof result.accessToken !== 'string' ||
              !result.accessToken.trim() ||
              !('expiresAt' in result) ||
              typeof result.expiresAt !== 'number' ||
              !Number.isFinite(result.expiresAt) ||
              result.expiresAt <= Date.now()
            )
              throw new Error('동기화 서버의 인증 응답이 올바르지 않습니다.')
            cached = { accessToken: result.accessToken, expiresAt: result.expiresAt }
            return result.accessToken
          } catch (error) {
            if (
              attempt >= 2 ||
              !(error instanceof ServerAuthError) ||
              error.status !== 503 ||
              generation !== current
            )
              throw error
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }
      })().finally(() => {
        if (generation === current) inFlight = undefined
      })
      return inFlight
    },
    async disconnect() {
      await request('/auth/logout', 'POST')
      clear()
    },
    connect(returnTo: string) {
      const url = new URL(`${baseUrl}/auth/google/start`)
      url.searchParams.set('returnTo', returnTo)
      window.location.assign(url.href)
    },
  }
}
