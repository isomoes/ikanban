import { expect, test } from "bun:test"
import { resolveBackendUrl } from "./backend-url"

test("uses the same-origin Pi backend under the Vite base path", () => {
  expect(resolveBackendUrl("http://localhost:3000", "/ikanban/")).toBe("http://localhost:3000/ikanban")
  expect(resolveBackendUrl("https://example.com", "/")).toBe("https://example.com")
})
