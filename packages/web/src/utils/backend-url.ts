export function resolveBackendUrl(origin: string, base: string) {
  const path = (base || "/").replace(/^\/+|\/+$/g, "")
  return path ? `${origin}/${path}` : origin
}
