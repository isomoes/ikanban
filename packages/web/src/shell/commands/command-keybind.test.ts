import { describe, expect, test } from "bun:test"
import { formatKeybind, formatKeybindParts, matchKeybind, parseKeybind } from "./command"

describe("command keybind helpers", () => {
  test("parseKeybind handles aliases and multiple combos", () => {
    const keybinds = parseKeybind("control+option+k, mod+shift+comma")

    expect(keybinds).toHaveLength(2)
    expect(keybinds[0]).toEqual({
      key: "k",
      ctrl: true,
      meta: false,
      shift: false,
      alt: true,
    })
    expect(keybinds[1]?.shift).toBe(true)
    expect(keybinds[1]?.key).toBe("comma")
    expect(Boolean(keybinds[1]?.ctrl || keybinds[1]?.meta)).toBe(true)
  })

  test("parseKeybind treats none and empty as disabled", () => {
    expect(parseKeybind("none")).toEqual([])
    expect(parseKeybind("")).toEqual([])
  })

  test("leader sequences stay distinct from direct alternatives and display both strokes", () => {
    const bindings = parseKeybind("<leader>w,ctrl+alt+w")
    expect(bindings[0]).toMatchObject({ key: "w", leader: true, ctrl: false })
    expect(matchKeybind(bindings, new KeyboardEvent("keydown", { key: "w" }))).toBe(false)
    expect(matchKeybind(bindings, new KeyboardEvent("keydown", { key: "w", ctrlKey: true, altKey: true }))).toBe(true)
    expect(formatKeybind("<leader>w")).toBe(`${formatKeybind("ctrl+space")} → W`)
    expect(formatKeybind("<leader>shift+t", undefined, "alt+space")).toBe(
      `${formatKeybind("alt+space")} → ${formatKeybind("shift+t")}`,
    )
    expect(formatKeybindParts("<leader>w")).toEqual([...formatKeybindParts("ctrl+space"), "→", "W"])
    expect(formatKeybind("arrowright")).toBe("→")
    expect(formatKeybind("<leader>arrowright", undefined, "ctrl+arrowright")).toBe(
      `${formatKeybind("ctrl+arrowright")} → →`,
    )
  })

  test("matchKeybind normalizes punctuation keys", () => {
    const keybinds = parseKeybind("ctrl+comma, shift+plus, meta+space")

    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: ",", ctrlKey: true }))).toBe(true)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: "+", shiftKey: true }))).toBe(true)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: " ", metaKey: true }))).toBe(true)
    expect(matchKeybind(keybinds, new KeyboardEvent("keydown", { key: ",", ctrlKey: true, altKey: true }))).toBe(false)
  })

  test("matchKeybind supports bracket keys", () => {
    const keybinds = parseKeybind("mod+alt+[, mod+alt+]")
    const prev = keybinds[0]
    const next = keybinds[1]

    expect(
      matchKeybind(
        keybinds,
        new KeyboardEvent("keydown", { key: "[", ctrlKey: prev?.ctrl, metaKey: prev?.meta, altKey: true }),
      ),
    ).toBe(true)
    expect(
      matchKeybind(
        keybinds,
        new KeyboardEvent("keydown", { key: "]", ctrlKey: next?.ctrl, metaKey: next?.meta, altKey: true }),
      ),
    ).toBe(true)
  })

  test("matchKeybind uses the letter key for option-modified characters", () => {
    expect(
      matchKeybind(
        parseKeybind("meta+alt+l"),
        new KeyboardEvent("keydown", { key: "¬", code: "KeyL", metaKey: true, altKey: true }),
      ),
    ).toBe(true)
  })

  test("formatKeybind returns human readable output", () => {
    const display = formatKeybind("ctrl+alt+arrowup")

    expect(display).toContain("↑")
    expect(display.includes("Ctrl") || display.includes("⌃")).toBe(true)
    expect(display.includes("Alt") || display.includes("⌥")).toBe(true)
    expect(formatKeybind("none")).toBe("")
  })

  test("formatKeybind prefers the first combo", () => {
    const display = formatKeybind("mod+k,mod+p")

    expect(display.includes("K") || display.includes("k")).toBe(true)
    expect(display.includes("P") || display.includes("p")).toBe(false)
  })
})
