const stockPrefix = '@deepseek-ai/dsh-client-'
const localPrefix = '@isomoes/dsh-web-ui/client/'

/** Point dependency edges at forked clients without aliasing published infrastructure. */
export function remapForkedClientInjects(graph: unknown): void {
  if (typeof graph !== 'object' || graph === null) return
  const entries = (graph as { entries?: unknown }).entries
  if (!Array.isArray(entries)) return

  const ids = new Set(entries.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const id = (entry as { id?: unknown }).id
    return typeof id === 'string' ? [id] : []
  }))

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue
    const inject = (entry as { inject?: unknown }).inject
    if (!Array.isArray(inject)) continue
    ;(entry as { inject: unknown[] }).inject = inject.map((dependency) => {
      if (typeof dependency !== 'string' || !dependency.startsWith(stockPrefix)) return dependency
      const localId = `${localPrefix}${dependency.slice(stockPrefix.length)}`
      return ids.has(localId) ? localId : dependency
    })
  }
}
