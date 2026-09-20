function normalizeBase(base: string) {
  const trimmed = base.replace(/\/+$/, "")
  if (!trimmed) return "/"
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

function stripBase(pathname: string, base: string) {
  const normalizedBase = normalizeBase(base)
  if (normalizedBase === "/") return pathname || "/"
  if (pathname === normalizedBase) return "/"
  if (pathname.startsWith(`${normalizedBase}/`)) return pathname.slice(normalizedBase.length) || "/"
  return pathname || "/"
}

export function shouldLoadProjectsOnBootstrap(pathname: string, base: string) {
  return stripBase(pathname, base) !== "/"
}
