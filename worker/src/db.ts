export interface DatabaseEnv {
  TURSO_DATABASE_URL: string
  TURSO_AUTH_TOKEN: string
}

type Value = string | number | null
type Cell = { type: string; value?: string | number }

export async function query<T>(env: DatabaseEnv, sql: string, args: Value[] = []): Promise<T[]> {
  const url = new URL(env.TURSO_DATABASE_URL.replace(/^libsql:/, 'https:'))
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.turso.io'))
    throw new Error('invalid_database_url')
  url.pathname = '/v2/pipeline'
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: args.map((value) =>
              value === null
                ? { type: 'null' }
                : typeof value === 'number'
                  ? { type: 'integer', value: String(value) }
                  : { type: 'text', value },
            ),
          },
        },
        { type: 'close' },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('database_unavailable')
  const body = (await response.json()) as {
    results?: Array<{
      type: string
      response?: { result: { cols: Array<{ name: string }>; rows: Cell[][] } }
    }>
  }
  const first = body.results?.[0]
  if (first?.type !== 'ok' || !first.response) throw new Error('database_query_failed')
  const result = first.response.result
  return result.rows.map(
    (row) =>
      Object.fromEntries(
        row.map((cell, index) => [
          result.cols[index].name,
          cell.type === 'null' ? null : cell.type === 'integer' ? Number(cell.value) : cell.value,
        ]),
      ) as T,
  )
}
