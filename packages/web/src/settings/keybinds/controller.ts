import { createMemo, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { makeEventListener } from "@solid-primitives/event-listener"
import { showToast } from "@/shell/notifications/toast"
import { DEFAULT_PALETTE_KEYBIND, formatKeybind, keyFromKeyboardEvent, useCommand } from "@/shell/commands/command"
import {
  DEFAULT_LEADER_KEYBIND,
  LEADER_ID,
  LEADER_TIMEOUT,
  isModifierKey,
  matchKeybind,
  parseKeybind,
} from "@/shell/commands/keybind"
import { useLanguage } from "@/runtime/i18n/language"
import type { useSettings } from "@/settings/model"
import { GROUPS, PALETTE_ID, filteredFor, groupedFor, keybinds, listFor, signatures } from "./catalog"

const IS_MAC = typeof navigator === "object" && /(Mac|iPod|iPhone|iPad)/.test(navigator.platform)

type CommandContext = ReturnType<typeof useCommand>
type LanguageContext = ReturnType<typeof useLanguage>
type SettingsContext = ReturnType<typeof useSettings>

function recordKeybind(event: KeyboardEvent) {
  if (isModifierKey(event.key)) return

  const parts: string[] = []

  const mod = IS_MAC ? event.metaKey : event.ctrlKey
  if (mod) parts.push("mod")

  if (IS_MAC && event.ctrlKey) parts.push("ctrl")
  if (!IS_MAC && event.metaKey) parts.push("meta")
  if (event.altKey) parts.push("alt")
  if (event.shiftKey) parts.push("shift")

  const key = keyFromKeyboardEvent(event)
  if (!key) return
  parts.push(key)

  return parts.join("+")
}

export function createKeybindSettingsController(
  input: {
    command: Pick<CommandContext, "catalog" | "options" | "keybinds">
    settings: {
      current: { keybinds: unknown }
      keybinds: Pick<SettingsContext["keybinds"], "get" | "set" | "resetAll">
    }
    target?: Document
    notify?: (toast: { title: string; description: string }) => void
  },
  language: Pick<LanguageContext, "locale" | "t"> = useLanguage(),
) {
  const [store, setStore] = createStore({ active: null as string | null, pending: false })
  let timer: ReturnType<typeof setTimeout> | undefined
  const leader = () => input.settings.keybinds.get(LEADER_ID) ?? DEFAULT_LEADER_KEYBIND
  const overrides = createMemo(() => keybinds(input.settings.current.keybinds))
  const list = createMemo(() => {
    language.locale()
    return listFor(
      input.command,
      overrides(),
      language.t("command.palette"),
      language.t("settings.shortcuts.leader"),
    )
  })
  const grouped = createMemo(() => groupedFor(list()))
  const title = (id: string) => list().get(id)?.title ?? ""
  const effective = (id: string) => {
    if (id === LEADER_ID) return leader()
    if (id === PALETTE_ID) return input.settings.keybinds.get(id) ?? DEFAULT_PALETTE_KEYBIND

    const custom = input.settings.keybinds.get(id)
    if (typeof custom === "string") return custom

    const live = input.command.options.find((item) => item.id === id)
    if (live) return live.keybind
    return input.command.catalog.find((item) => item.id === id)?.keybind
  }
  const used = createMemo(() => {
    const value = new Map<string, { id: string; title: string }[]>()

    for (const id of list().keys()) {
      for (const signature of signatures(effective(id))) {
        const items = value.get(signature)
        if (items) {
          items.push({ id, title: title(id) })
          continue
        }
        value.set(signature, [{ id, title: title(id) }])
      }
    }

    return value
  })
  const stop = () => {
    clearTimeout(timer)
    if (!store.active) return
    setStore({ active: null, pending: false })
    input.command.keybinds(true)
  }
  const toggle = (id: string) => {
    if (store.active === id) {
      stop()
      return
    }
    if (store.active) stop()
    setStore("active", id)
    input.command.keybinds(false)
  }
  const notify = input.notify ?? ((toast: { title: string; description: string }) => showToast(toast))

  const handle = (event: KeyboardEvent) => {
    const id = store.active
    if (!id) return
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    if (event.repeat) return

    if (event.key === "Escape") {
      stop()
      return
    }

    const clear =
      (event.key === "Backspace" || event.key === "Delete") &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey
    if (clear && !store.pending) {
      input.settings.keybinds.set(id, "none")
      stop()
      return
    }

    if (id !== LEADER_ID && matchKeybind(parseKeybind(leader()), event)) {
      clearTimeout(timer)
      setStore("pending", true)
      timer = setTimeout(() => setStore("pending", false), LEADER_TIMEOUT)
      return
    }

    const key = recordKeybind(event)
    if (!key) return
    const next = `${store.pending ? "<leader>" : ""}${key}`
    clearTimeout(timer)
    setStore("pending", false)

    const conflicts = new Map<string, string>()
    for (const signature of signatures(next)) {
      for (const item of used().get(signature) ?? []) {
        if (item.id === id) continue
        conflicts.set(item.id, item.title)
      }
    }

    if (conflicts.size > 0) {
      notify({
        title: language.t("settings.shortcuts.conflict.title"),
        description: language.t("settings.shortcuts.conflict.description", {
          keybind: formatKeybind(next, language.t, leader()),
          titles: [...conflicts.values()].join(", "),
        }),
      })
      return
    }

    input.settings.keybinds.set(id, next)
    stop()
  }

  const target = input.target ?? (typeof document === "object" ? document : undefined)
  if (target) makeEventListener(target, "keydown", handle, { capture: true })
  if (target?.defaultView) makeEventListener(target.defaultView, "blur", stop)

  onCleanup(() => {
    clearTimeout(timer)
    if (store.active) input.command.keybinds(true)
  })

  return {
    catalog: {
      groups: GROUPS,
      filtered: (query: string) =>
        filteredFor(query, list(), grouped(), (id) => formatKeybind(effective(id) ?? "", language.t, leader())),
      title,
      keybind: (id: string) => formatKeybind(effective(id) ?? "", language.t, leader()),
    },
    capture: {
      active: () => store.active,
      pending: () => store.pending,
      toggle,
    },
    settings: {
      hasOverrides: () => Object.values(overrides()).some((value) => typeof value === "string"),
      reset: () => {
        stop()
        input.settings.keybinds.resetAll()
        notify({
          title: language.t("settings.shortcuts.reset.toast.title"),
          description: language.t("settings.shortcuts.reset.toast.description"),
        })
      },
    },
  }
}
