/** The queue owns ordering only. Callers own cancellation and UI state. */
export function createSerialQueue() {
  let tail: Promise<void> = Promise.resolve()
  return {
    run(operation: () => Promise<void>) {
      const result = tail.then(operation)
      tail = result.catch(() => undefined)
      return result
    },
    idle: () => tail,
  }
}
