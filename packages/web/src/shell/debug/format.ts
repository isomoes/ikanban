export const ms = (n?: number, d = 0) => {
  if (n === undefined || Number.isNaN(n)) return
  return `${n.toFixed(d)}ms`
}

export const time = (n?: number) => {
  if (n === undefined || Number.isNaN(n)) return
  return `${Math.round(n)}`
}

export const fixed = (n?: number, digits = 0) => {
  if (n === undefined || Number.isNaN(n)) return
  return n.toFixed(digits)
}

export const mb = (n?: number) => {
  if (n === undefined || Number.isNaN(n)) return
  const v = n / 1024 / 1024
  return `${v >= 1024 ? v.toFixed(0) : v.toFixed(1)}MB`
}

export const duration = (n?: number) => {
  if (n === undefined || Number.isNaN(n)) return
  if (n < 1_000) return `${Math.round(n)}ms`
  return `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}s`
}

export const bad = (n: number | undefined, limit: number, low = false) => {
  if (n === undefined || Number.isNaN(n)) return false
  return low ? n < limit : n > limit
}

export const session = (path: string) => path.includes("/session")
