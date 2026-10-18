import { describe, expect, it } from 'vitest'
import { createSerialQueue } from './serialQueue'

describe('Drive upload ordering', () => {
  it('never lets an older slow write overwrite a newer queued revision', async () => {
    const queue = createSerialQueue()
    const events: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = queue.run(async () => {
      events.push('old:start')
      await gate
      events.push('old:finish')
    })
    const second = queue.run(async () => {
      events.push('new:finish')
    })
    await Promise.resolve()
    expect(events).toEqual(['old:start'])
    release()
    await Promise.all([first, second, queue.idle()])
    expect(events).toEqual(['old:start', 'old:finish', 'new:finish'])
  })
  it('allows the next write after a transient failure', async () => {
    const queue = createSerialQueue()
    await expect(
      queue.run(async () => {
        throw new Error('offline')
      }),
    ).rejects.toThrow('offline')
    let saved = false
    await queue.run(async () => {
      saved = true
    })
    expect(saved).toBe(true)
  })
})
