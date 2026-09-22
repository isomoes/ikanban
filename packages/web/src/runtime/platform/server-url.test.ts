import { describe, expect, test } from "bun:test"
import { configuredServerUrl } from "./server-url"

describe("static frontend backend selection", () => {
  test("requires an explicit backend, including during local development", () => {
    expect(configuredServerUrl(undefined)).toBeUndefined()
    expect(configuredServerUrl("")).toBeUndefined()
    expect(configuredServerUrl("  ")).toBeUndefined()
  })

  test("normalizes explicit HTTP and HTTPS backends", () => {
    expect(configuredServerUrl(" https://backend.example/ ")).toBe("https://backend.example")
    expect(configuredServerUrl("http://127.0.0.1:4096/")).toBe("http://127.0.0.1:4096")
  })

  test("does not interpret relative URLs as requests to the Pages host", () => {
    expect(configuredServerUrl("/api")).toBeUndefined()
    expect(configuredServerUrl("//backend.example")).toBeUndefined()
    expect(configuredServerUrl("backend.example")).toBeUndefined()
  })

  test("keeps authentication out of build-time backend URLs", () => {
    expect(configuredServerUrl("https://opencode:secret@backend.example")).toBeUndefined()
    expect(configuredServerUrl("https://backend.example?token=secret")).toBeUndefined()
    expect(configuredServerUrl("https://backend.example#secret")).toBeUndefined()
    expect(configuredServerUrl("file:///api")).toBeUndefined()
  })
})
