import { OpenCode } from "@opencode/client"

// Static hosting connects directly to a configured server with CORS enabled.
// Authentication is supplied by the future UI.
export function createClient(options: { baseUrl?: string; headers?: HeadersInit } = {}) {
  const baseUrl = options.baseUrl || import.meta.env.VITE_OPENCODE_URL
  if (!baseUrl) throw new Error("Select an OpenCode V2 server or set VITE_OPENCODE_URL")
  return OpenCode.make({
    baseUrl,
    headers: options.headers,
  })
}
