import { OpenCode } from "@opencode-ai/client"
import type { ServerConnection } from "@/context/server"

export function createSdkForServer({
  server,
  ...config
}: Omit<Parameters<typeof OpenCode.make>[0], "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = (() => {
    if (!server.password) return
    return {
      Authorization: `Basic ${btoa(`${server.username ?? "opencode"}:${server.password}`)}`,
    }
  })()

  return OpenCode.make({
    ...config,
    headers: { ...config.headers, ...auth },
    baseUrl: server.url,
  })
}
