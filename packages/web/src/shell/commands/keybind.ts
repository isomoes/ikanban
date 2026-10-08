import en from "@/runtime/i18n/en"

const IS_MAC = typeof navigator === "object" && /(Mac|iPod|iPhone|iPad)/.test(navigator.platform)

export type KeyLabel =
  | "common.key.ctrl"
  | "common.key.alt"
  | "common.key.shift"
  | "common.key.meta"
  | "common.key.space"
  | "common.key.backspace"
  | "common.key.enter"
  | "common.key.tab"
  | "common.key.delete"
  | "common.key.home"
  | "common.key.end"
  | "common.key.pageUp"
  | "common.key.pageDown"
  | "common.key.insert"
  | "common.key.esc"

function keyText(key: KeyLabel, t?: (key: KeyLabel) => string) {
  return t ? t(key) : en[key]
}

function normalizeKey(key: string) {
  if (key === ",") return "comma"
  if (key === "+") return "plus"
  if (key === " ") return "space"
  return key.toLowerCase()
}

export function keyFromKeyboardEvent(event: KeyboardEvent) {
  const key = normalizeKey(event.key)
  if (!event.altKey || /^[a-z0-9]$/.test(key)) return key
  if (!event.code.startsWith("Key") || event.code.length !== 4) return key
  return event.code.slice(3).toLowerCase()
}

export function signature(key: string, ctrl: boolean, meta: boolean, shift: boolean, alt: boolean) {
  const mask = (ctrl ? 1 : 0) | (meta ? 2 : 0) | (shift ? 4 : 0) | (alt ? 8 : 0)
  return `${key}:${mask}`
}

export function signatureFromEvent(event: KeyboardEvent) {
  return signature(keyFromKeyboardEvent(event), event.ctrlKey, event.metaKey, event.shiftKey, event.altKey)
}

export type KeybindConfig = string

export interface Keybind {
  key: string
  ctrl: boolean
  meta: boolean
  shift: boolean
  alt: boolean
}

export function parseKeybind(config: string): Keybind[] {
  if (!config || config === "none") return []

  return config.split(",").map((combo) => {
    const parts = combo.trim().toLowerCase().split("+")
    const keybind: Keybind = {
      key: "",
      ctrl: false,
      meta: false,
      shift: false,
      alt: false,
    }

    for (const part of parts) {
      switch (part) {
        case "ctrl":
        case "control":
          keybind.ctrl = true
          break
        case "meta":
        case "cmd":
        case "command":
          keybind.meta = true
          break
        case "mod":
          if (IS_MAC) keybind.meta = true
          else keybind.ctrl = true
          break
        case "alt":
        case "option":
          keybind.alt = true
          break
        case "shift":
          keybind.shift = true
          break
        default:
          keybind.key = part
          break
      }
    }

    return keybind
  })
}

export function matchKeybind(keybinds: Keybind[], event: KeyboardEvent): boolean {
  const eventKey = keyFromKeyboardEvent(event)

  for (const kb of keybinds) {
    const keyMatch = kb.key === eventKey
    const ctrlMatch = kb.ctrl === (event.ctrlKey || false)
    const metaMatch = kb.meta === (event.metaKey || false)
    const shiftMatch = kb.shift === (event.shiftKey || false)
    const altMatch = kb.alt === (event.altKey || false)

    if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
      return true
    }
  }

  return false
}

function displayKeybindParts(kb: Keybind, t?: (key: KeyLabel) => string) {
  const parts: string[] = []

  if (kb.ctrl) parts.push(IS_MAC ? "⌃" : keyText("common.key.ctrl", t))
  if (kb.alt) parts.push(IS_MAC ? "⌥" : keyText("common.key.alt", t))
  if (kb.shift) parts.push(IS_MAC ? "⇧" : keyText("common.key.shift", t))
  if (kb.meta) parts.push(IS_MAC ? "⌘" : keyText("common.key.meta", t))

  if (!kb.key) return parts

  const keys: Record<string, string> = {
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    comma: ",",
    plus: "+",
  }
  const named: Record<string, KeyLabel> = {
    backspace: "common.key.backspace",
    delete: "common.key.delete",
    end: "common.key.end",
    enter: "common.key.enter",
    esc: "common.key.esc",
    escape: "common.key.esc",
    home: "common.key.home",
    insert: "common.key.insert",
    pagedown: "common.key.pageDown",
    pageup: "common.key.pageUp",
    space: "common.key.space",
    tab: "common.key.tab",
  }
  const key = kb.key.toLowerCase()
  const displayKey =
    keys[key] ??
    (named[key]
      ? keyText(named[key], t)
      : key.length === 1
        ? key.toUpperCase()
        : key.charAt(0).toUpperCase() + key.slice(1))
  parts.push(displayKey)

  return parts
}

export function formatKeybindParts(config: string, t?: (key: KeyLabel) => string): string[] {
  if (!config || config === "none") return []
  const keybind = parseKeybind(config)[0]
  return keybind ? displayKeybindParts(keybind, t) : []
}

export function formatKeybind(config: string, t?: (key: KeyLabel) => string): string {
  const parts = formatKeybindParts(config, t)
  if (parts.length === 0) return ""
  return IS_MAC ? parts.join("") : parts.join("+")
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest("[contenteditable='true']")) return true
  if (target.closest("input, textarea, select")) return true
  return false
}
