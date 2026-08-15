const RESULT_LIMIT = 100

function boundaryBonus(path: string, index: number): number {
  return index === 0 || '/-_.'.includes(path.charAt(index - 1)) ? 8 : 0
}

function fuzzyScore(path: string, query: string): number | undefined {
  if (query === '') return 0
  if (query.length > path.length) return undefined
  const noMatch = Number.NEGATIVE_INFINITY
  let previous = Array<number>(path.length).fill(noMatch)
  for (let index = 0; index < path.length; index++) {
    if (path.charAt(index) === query.charAt(0)) previous[index] = 1 + boundaryBonus(path, index) - index
  }
  for (let queryIndex = 1; queryIndex < query.length; queryIndex++) {
    const current = Array<number>(path.length).fill(noMatch)
    let bestGapped = noMatch
    for (let index = 0; index < path.length; index++) {
      const gappedIndex = index - 2
      if (gappedIndex >= 0) {
        const prior = previous[gappedIndex] ?? noMatch
        if (prior !== noMatch) bestGapped = Math.max(bestGapped, prior + gappedIndex)
      }
      if (path.charAt(index) !== query.charAt(queryIndex)) continue
      const bonus = 1 + boundaryBonus(path, index)
      const adjacent = index > 0 ? previous[index - 1] ?? noMatch : noMatch
      if (adjacent !== noMatch) current[index] = adjacent + bonus + 4
      if (bestGapped !== noMatch) current[index] = Math.max(current[index] ?? noMatch, bestGapped + bonus + 1 - index)
    }
    previous = current
  }
  const best = Math.max(...previous)
  return best === noMatch ? undefined : best
}

/** Fuzzy-rank complete workspace-relative paths using an ordered subsequence. */
export function fuzzyWorkspaceFiles(files: readonly string[], query: string): string[] {
  const needle = query.toLocaleLowerCase()
  if (needle === '') return files.slice(0, RESULT_LIMIT)
  return files
    .map((path, index) => {
      const normalized = path.toLocaleLowerCase()
      return { path, index, prefix: normalized.startsWith(needle), score: fuzzyScore(normalized, needle) }
    })
    .filter((match): match is typeof match & { score: number } => match.score !== undefined)
    .sort((left, right) => Number(right.prefix) - Number(left.prefix)
      || right.score - left.score || left.index - right.index)
    .map(match => match.path)
    .slice(0, RESULT_LIMIT)
}
