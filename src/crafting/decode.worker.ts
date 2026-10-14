import { decompress } from 'fzstd'

self.onmessage = (
  event: MessageEvent<{ id: number; buffer: ArrayBuffer; decodedBytes: number }>,
) => {
  const { id, buffer, decodedBytes } = event.data
  try {
    const raw = decompress(new Uint8Array(buffer))
    if (raw.byteLength !== decodedBytes) throw new Error('데이터 크기가 일치하지 않습니다.')
    self.postMessage({ id, value: JSON.parse(new TextDecoder().decode(raw)) })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : '압축 해제 실패' })
  }
}
