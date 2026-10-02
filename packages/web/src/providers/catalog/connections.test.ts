import { describe, expect, test } from "bun:test"
import type { IntegrationInfo } from "@opencode/client/promise"
import { providerConnection } from "./connections"

const integration = (connections: IntegrationInfo["connections"]): IntegrationInfo => ({
  id: "openai",
  name: "OpenAI",
  methods: [],
  connections,
})

describe("providerConnection", () => {
  test("distinguishes OAuth accounts from API keys", () => {
    for (const method of ["oauth", "key"] as const) {
      expect(providerConnection(integration([{ type: "credential", id: "account", label: "Work", method }]))).toEqual({
        method,
        auth: undefined,
      })
    }
  })

  test("surfaces authentication failures for credentials and environment connections", () => {
    const status = { status: "needs_auth", message: "Account expired", url: "https://example.com/login" } as const
    expect(
      providerConnection(integration([{ type: "credential", id: "account", label: "Work", method: "oauth", status }])).auth,
    ).toEqual(status)
    expect(providerConnection(integration([{ type: "env", name: "OPENAI_API_KEY", status }])).auth).toEqual(status)
  })

  test("handles unloaded or connectionless integrations", () => {
    expect(providerConnection(undefined)).toEqual({ method: undefined, auth: undefined })
    expect(providerConnection(integration([]))).toEqual({ method: undefined, auth: undefined })
  })
})
