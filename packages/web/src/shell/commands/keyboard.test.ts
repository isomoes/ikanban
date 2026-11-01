import { describe, expect, test } from "bun:test"
import { createCommandKeyboard } from "./keyboard"
import { keybindSignature, LEADER_TIMEOUT, parseKeybind, signatureFromEvent } from "./keybind"
import { resolveKeybindOption, type CommandOption } from "./command"

function setup() {
  const actions: string[] = []
  const terminal = document.createElement("div")
  terminal.dataset.component = "terminal"
  const input = document.createElement("textarea")
  terminal.append(input)
  document.body.append(terminal)
  const options: CommandOption[] = [
    { id: "tab.close", title: "Close tab", keybind: "<leader>w" },
    {
      id: "terminal.close",
      title: "Close terminal",
      keybind: "<leader>w",
      when: (event) => event.target instanceof Element && !!event.target.closest('[data-component="terminal"]'),
    },
    { id: "palette", title: "Palette", keybind: "<leader>p" },
    { id: "direct", title: "Direct", keybind: "ctrl+k" },
  ]
  let enabled = true
  let leader = "ctrl+space"
  const keyboard = createCommandKeyboard({
    enabled: () => enabled,
    leader: () => leader,
    resolve: (event, prefixed) => {
      const sig = `${prefixed ? "<leader>" : ""}${signatureFromEvent(event)}`
      const option = resolveKeybindOption(
        options.filter((option) => parseKeybind(option.keybind!).some((kb) => keybindSignature(kb) === sig)),
        event,
      )
      if (option) return () => void actions.push(option.id)
    },
  })
  document.addEventListener("keydown", keyboard.keydown, true)
  document.addEventListener("keyup", keyboard.keyup, true)
  const down = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }
  const up = (key: string, target: EventTarget = document.body) =>
    target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }))
  return {
    actions,
    input,
    keyboard,
    down,
    up,
    leader(value: string) {
      leader = value
    },
    enabled(value: boolean) {
      enabled = value
    },
    prefix(target?: EventTarget) {
      const event = down(" ", { ctrlKey: true }, target)
      up(" ", target)
      up("Control", target)
      return event
    },
    dispose() {
      keyboard.reset()
      document.removeEventListener("keydown", keyboard.keydown, true)
      document.removeEventListener("keyup", keyboard.keyup, true)
      terminal.remove()
    },
  }
}

describe("leader keyboard dispatch", () => {
  test("requires the prefix, preserves browser shortcuts, and resolves the focused context", () => {
    const state = setup()
    try {
      expect(state.down("w").defaultPrevented).toBe(false)
      expect(state.down("w", { ctrlKey: true }).defaultPrevented).toBe(false)
      expect(state.actions).toEqual([])
      expect(state.prefix().defaultPrevented).toBe(true)
      expect(state.down("w").defaultPrevented).toBe(true)
      state.up("w")
      state.prefix(state.input)
      expect(state.down("w", {}, state.input).defaultPrevented).toBe(true)
      expect(state.actions).toEqual(["tab.close", "terminal.close"])
      state.up("w", state.input)
      expect(state.down("w", {}, state.input).defaultPrevented).toBe(false)
    } finally {
      state.dispose()
    }
  })

  test("cancels Escape and unknown suffixes without falling through to direct shortcuts", () => {
    const state = setup()
    try {
      state.prefix()
      expect(state.down("k", { ctrlKey: true }).defaultPrevented).toBe(true)
      expect(state.actions).toEqual([])
      state.prefix()
      state.down("Escape")
      state.up("Escape")
      expect(state.down("w").defaultPrevented).toBe(false)
      state.down("k", { ctrlKey: true })
      expect(state.actions).toEqual(["direct"])
      state.prefix()
      state.up("Escape")
      expect(state.down("w").defaultPrevented).toBe(false)
    } finally {
      state.dispose()
    }
  })

  test("ignores held keys and modifier-only events while accepting a single suffix", () => {
    const state = setup()
    try {
      state.down(" ", { ctrlKey: true })
      state.down(" ", { ctrlKey: true, repeat: true })
      state.up(" ")
      state.down("Shift", { shiftKey: true })
      state.up("Shift")
      state.down("w")
      expect(state.down("w", { repeat: true }).defaultPrevented).toBe(true)
      expect(state.actions).toEqual(["tab.close"])
      state.up("w")
      expect(state.down("w").defaultPrevented).toBe(false)
    } finally {
      state.dispose()
    }
  })

  test("respects suspension, composition, prevented events, resets, and custom/disabled leaders", () => {
    const state = setup()
    try {
      state.prefix()
      state.enabled(false)
      expect(state.down("w").defaultPrevented).toBe(false)
      state.enabled(true)
      state.prefix()
      expect(state.down("w", { isComposing: true }).defaultPrevented).toBe(false)
      state.prefix()
      const prevented = new KeyboardEvent("keydown", { key: "w", cancelable: true })
      prevented.preventDefault()
      state.keyboard.keydown(prevented)
      state.prefix()
      state.keyboard.reset()
      state.down("w")
      expect(state.actions).toEqual([])
      state.leader("alt+space")
      expect(state.prefix().defaultPrevented).toBe(false)
      state.down(" ", { altKey: true })
      state.up(" ")
      state.down("p")
      expect(state.actions).toEqual(["palette"])
      state.leader("none")
      expect(state.prefix().defaultPrevented).toBe(false)
      expect(state.down("w").defaultPrevented).toBe(false)
    } finally {
      state.dispose()
    }
  })

  test("expires an incomplete sequence", async () => {
    const state = setup()
    try {
      state.prefix()
      await new Promise((resolve) => setTimeout(resolve, LEADER_TIMEOUT + 25))
      expect(state.down("w").defaultPrevented).toBe(false)
      expect(state.actions).toEqual([])
    } finally {
      state.dispose()
    }
  })
})
