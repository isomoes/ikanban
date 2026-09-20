import { OpenCode, type OpenCodeClient } from "@opencode/client"

/** The only network client: browser → authenticated OpenCode V2 server. */
export function createClient(
  options: { baseUrl?: string; headers?: HeadersInit; fetch?: typeof globalThis.fetch } = {},
): OpenCodeClient {
  const baseUrl = options.baseUrl || import.meta.env.VITE_OPENCODE_URL
  if (!baseUrl) throw new Error("Select an OpenCode V2 server or set VITE_OPENCODE_URL")
  const url = new URL(baseUrl)
  if (!/^https?:$/.test(url.protocol)) throw new Error("OpenCode server must use HTTP or HTTPS")
  return OpenCode.make({ baseUrl: url.href.replace(/\/$/, ""), headers: options.headers, fetch: options.fetch })
}
