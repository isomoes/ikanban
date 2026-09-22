/** Pages hosts the application only; a backend must be explicitly configured. */
export function configuredServerUrl(value: string | undefined) {
  if (!value?.trim()) return
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return
    if (url.username || url.password || url.search || url.hash) return
    return url.href.replace(/\/+$/, "")
  } catch {
    return
  }
}
