export function createPasteUndoHistory<T>() {
  const entries: T[] = []

  return {
    push(entry: T) {
      entries.push(entry)
    },
    capture(entry: T) {
      let committed = false
      return () => {
        if (committed) return
        committed = true
        entries.push(entry)
      }
    },
    peek() {
      return entries.at(-1)
    },
    pop() {
      return entries.pop()
    },
    clear() {
      entries.length = 0
    },
  }
}
