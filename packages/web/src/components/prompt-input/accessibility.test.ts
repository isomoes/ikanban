import { describe, expect, test } from "bun:test"

const promptSource = await Bun.file(new URL("../prompt-input.tsx", import.meta.url)).text()
const popoverSource = await Bun.file(new URL("./slash-popover.tsx", import.meta.url)).text()
const contextSource = await Bun.file(new URL("./context-items.tsx", import.meta.url)).text()
const imageSource = await Bun.file(new URL("./image-attachments.tsx", import.meta.url)).text()

describe("prompt input accessibility", () => {
  test("connects the editor to its suggestion listbox", () => {
    expect(promptSource).toContain('role="combobox"')
    expect(promptSource).toContain("aria-activedescendant")
    expect(popoverSource).toContain('role="listbox"')
    expect(popoverSource).toContain('role="option"')
    expect(popoverSource).toContain("aria-selected")
  })

  test("uses separate keyboard-operable attachment controls", () => {
    expect(contextSource).toContain('data-action="prompt-context-open"')
    expect(contextSource).toContain("const selected = () => props.active(item)")
    expect(imageSource).toContain('data-action="prompt-image-open"')
    expect(imageSource).toContain("group-focus-within:opacity-100")
  })

  test("bounds the complete composer against the dynamic viewport", () => {
    expect(promptSource).toContain('data-component="prompt-composer"')
    expect(promptSource).not.toContain("_max-h-[320px]")
  })
})
