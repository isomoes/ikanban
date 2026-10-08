import { describe, expect, test } from "bun:test"
import { methodDetails, methodLabel } from "./method"

const t = (key: string) => key

describe("provider connect method details", () => {
  test("labels api key methods with the translated label", () => {
    expect(methodLabel({ type: "key" }, t)).toBe("provider.connect.method.apiKey")
    expect(methodLabel({ type: "oauth", label: "ChatGPT" }, t)).toBe("ChatGPT")
    expect(methodLabel(undefined, t)).toBe("")
  })

  test("splits the browser or headless suffix into a hint", () => {
    expect(methodDetails({ type: "oauth", label: "ChatGPT (browser)" }, t)).toEqual({
      label: "ChatGPT",
      hint: "provider.connect.method.browser",
    })
    expect(methodDetails({ type: "oauth", label: "ChatGPT (Headless)" }, t)).toEqual({
      label: "ChatGPT",
      hint: "provider.connect.method.headless",
    })
    expect(methodDetails({ type: "oauth", label: "Claude Pro/Max" }, t)).toEqual({
      label: "Claude Pro/Max",
      hint: undefined,
    })
    expect(methodDetails({ type: "key" }, t).hint).toBe("provider.connect.method.browser")
  })
})
