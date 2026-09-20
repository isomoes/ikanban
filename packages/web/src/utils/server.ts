import { createUIClient, type UIClientOptions } from "@/client/adapter"
import type { ServerConnection } from "@/context/server"

export function createSdkForServer({
  server,
  ...config
}: Omit<UIClientOptions, "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = (() => {
    if (server.token) return { Authorization: `Bearer ${server.token}` }
    if (!server.password) return
    if (server.authType === "bearer") return { Authorization: `Bearer ${server.password}` }
    return {
      Authorization: `Basic ${btoa(`${server.username ?? "opencode"}:${server.password}`)}`,
    }
  })()

  const headers = new Headers(config.headers)
  for (const [key, value] of Object.entries(auth ?? {})) headers.set(key, value)
  return createUIClient({
    ...config,
    headers,
    baseUrl: server.url,
  })
}
