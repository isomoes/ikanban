import type { IntegrationInfo } from "@opencode/client/promise"

export function providerConnection(integration: IntegrationInfo | undefined) {
  const connections = integration?.connections ?? []
  const credential = connections.find((connection) => connection.type === "credential")
  return {
    method: credential?.method,
    auth: connections.find((connection) => connection.status?.status === "needs_auth")?.status,
  }
}
