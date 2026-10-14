import type { CatalogManifest, ChunkFile, ItemDetail, SearchItem } from './types'

const base = `${import.meta.env.BASE_URL}crafting/`
let manifestPromise: Promise<CatalogManifest> | undefined
let indexPromise: Promise<SearchItem[]> | undefined
let worker: Worker | undefined
let serial = 0
const requests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>()
const memory = new Map<string, Record<string, ItemDetail>>()
const pendingChunks = new Map<string, Promise<Record<string, ItemDetail>>>()

function decode(buffer: ArrayBuffer, decodedBytes: number): Promise<unknown> {
  if (!worker) {
    worker = new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event) => {
      const request = requests.get(event.data.id)
      requests.delete(event.data.id)
      if (event.data.error) request?.reject(new Error(event.data.error))
      else request?.resolve(event.data.value)
    }
    worker.onerror = () => {
      requests.forEach((request) =>
        request.reject(new Error('데이터 압축 해제 작업이 중단되었습니다.')),
      )
      requests.clear()
      worker?.terminate()
      worker = undefined
    }
  }
  return new Promise((resolve, reject) => {
    const id = ++serial
    requests.set(id, { resolve, reject })
    worker!.postMessage({ id, buffer, decodedBytes }, [buffer])
  })
}

async function loadCompressed(file: ChunkFile): Promise<unknown> {
  const url = new URL(base + file.file, window.location.href).href
  let cache: Cache | undefined
  try {
    cache = await caches.open('bdo-crafting-zstd-v1')
  } catch {
    /* private browsing can disable Cache API */
  }
  const cached = await cache?.match(url)
  const response = cached ?? (await fetch(url))
  if (!response.ok) throw new Error(`카탈로그 다운로드 실패 (${response.status})`)
  const buffer = await response.clone().arrayBuffer()
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  if (hash !== file.sha256) {
    await cache?.delete(url)
    throw new Error('카탈로그 파일이 손상되었습니다. 다시 시도해 주세요.')
  }
  if (!cached) {
    try {
      await cache?.put(url, response)
    } catch {
      /* storage quota: memory-only use */
    }
  }
  return decode(buffer, file.decodedBytes)
}

export function loadManifest() {
  manifestPromise ??= fetch(`${base}manifest.json`, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) throw new Error('제작노트 데이터가 아직 배포되지 않았습니다.')
      const value: CatalogManifest = await response.json()
      if (value.schemaVersion !== 1) throw new Error('지원하지 않는 카탈로그 버전입니다.')
      return value
    })
    .catch((error) => {
      manifestPromise = undefined
      throw error
    })
  return manifestPromise
}
export function loadSearchIndex() {
  indexPromise ??= loadManifest()
    .then((manifest) => loadCompressed(manifest.searchIndex) as Promise<SearchItem[]>)
    .catch((error) => {
      indexPromise = undefined
      throw error
    })
  return indexPromise
}
export async function loadItemDetail(id: string): Promise<ItemDetail> {
  const [manifest, index] = await Promise.all([loadManifest(), loadSearchIndex()])
  const entry = index.find((item) => item.id === id)
  if (!entry) throw new Error('아이템을 찾을 수 없습니다.')
  const chunk = manifest.chunks[entry.chunk]
  if (!memory.has(chunk.file)) {
    let pending = pendingChunks.get(chunk.file)
    if (!pending) {
      pending = loadCompressed(chunk)
        .then((value) => {
          const records = value as Record<string, ItemDetail>
          if (memory.size >= 8) memory.delete(memory.keys().next().value!)
          memory.set(chunk.file, records)
          return records
        })
        .finally(() => pendingChunks.delete(chunk.file))
      pendingChunks.set(chunk.file, pending)
    }
    const records = await pending
    if (!records[id]) throw new Error('청크에 아이템이 없습니다.')
    return records[id]
  }
  const records = memory.get(chunk.file)!
  memory.delete(chunk.file)
  memory.set(chunk.file, records)
  return records[id]
}
