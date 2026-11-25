// Serialize changes per server path: a slow unwatch on a closing tab must
// finish before a new tab registers the same file again.
export function createFileWatchLeases() {
  const entries = new Map<string, { count: number; pending: Promise<void> }>()
  return (key: string, watch: () => Promise<void>, unwatch: () => Promise<void>) => {
    const entry = entries.get(key) ?? { count: 0, pending: Promise.resolve() }
    entries.set(key, entry)
    const renew = () => {
      entry.pending = entry.pending.then(watch).catch(() => {})
      return entry.pending
    }
    if (++entry.count === 1) renew()
    return {
      ready: entry.pending,
      renew,
      release() {
        if (--entry.count) return entry.pending
        const last = entry.pending.then(unwatch).catch(() => {})
        entry.pending = last
        return last.then(() => {
          if (!entry.count && entry.pending === last) entries.delete(key)
        })
      },
    }
  }
}
