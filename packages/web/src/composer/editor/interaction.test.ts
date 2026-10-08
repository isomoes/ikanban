import { expect, test } from "bun:test"
import { shouldHandlePasteAsAttachment } from "./interaction"

test("leaves paste to the browser when web clipboard data is unavailable", () => {
  expect(shouldHandlePasteAsAttachment(clipboard())).toBe(false)
  expect(shouldHandlePasteAsAttachment(clipboard(["text/plain"]))).toBe(false)
})

test("handles clipboard files as attachments", () => {
  expect(shouldHandlePasteAsAttachment(clipboard([], [{ kind: "file" }]))).toBe(true)
})

function clipboard(types: string[] = [], items: Array<{ kind: string }> = []) {
  return { types, items } as unknown as DataTransfer
}
