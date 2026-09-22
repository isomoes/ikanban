// Router navigation targets are app-relative. Browser hrefs and useLocation()
// include Vite's deployment base; convert only at those boundaries.
export function normalizeBase(base: string) {
  const path = base.replace(/^\/+|\/+$/g, "")
  return path ? `/${path}` : ""
}

export const appBase = normalizeBase(import.meta.env?.BASE_URL ?? "/ikanban/")

export function appHref(path: string, base = appBase) {
  return `${normalizeBase(base)}${path.startsWith("/") ? path : `/${path}`}`
}

/** Return an app-relative pathname, or undefined for a path outside this app. */
export function stripBase(pathname: string, base = appBase) {
  const prefix = normalizeBase(base)
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return
  if (pathname === prefix) return "/"
  if (!pathname.startsWith(`${prefix}/`)) return
  return pathname.slice(prefix.length) || "/"
}

/** Preloading accepts both app-relative targets and deployed deep links. */
export function preloadPathname(value: string, base = appBase) {
  try {
    const pathname = value.startsWith("/") ? value.split(/[?#]/, 1)[0] : new URL(value).pathname
    return (stripBase(pathname, base) ?? pathname).replace(/\/$/, "") || "/"
  } catch {
    return undefined
  }
}
