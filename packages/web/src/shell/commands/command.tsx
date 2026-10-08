import { createSimpleContext } from "@ikanban/ui/context"
import { useDialog } from "@ikanban/ui/context/dialog"
import { type Accessor, batch, createEffect, createMemo, onCleanup, onMount } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"
import { makeEventListener } from "@solid-primitives/event-listener"
import { useLanguage } from "@/runtime/i18n/language"
import { useSettings } from "@/settings/model"
import { Persist, persisted } from "@/runtime/persistence/storage"
import {
  formatKeybind,
  formatKeybindParts,
  isEditableTarget,
  parseKeybind,
  signature,
  signatureFromEvent,
  type KeybindConfig,
} from "./keybind"

export {
  formatKeybind,
  formatKeybindParts,
  keyFromKeyboardEvent,
  matchKeybind,
  parseKeybind,
  type Keybind,
  type KeybindConfig,
} from "./keybind"

const PALETTE_ID = "command.palette"
export const DEFAULT_PALETTE_KEYBIND = "mod+p"
const SUGGESTED_PREFIX = "suggested."
const EDITABLE_KEYBIND_IDS = new Set(["terminal.toggle", "terminal.new", "file.attach"])

function actionId(id: string) {
  if (!id.startsWith(SUGGESTED_PREFIX)) return id
  return id.slice(SUGGESTED_PREFIX.length)
}

function isAllowedEditableKeybind(id: string | undefined) {
  if (!id) return false
  return EDITABLE_KEYBIND_IDS.has(actionId(id))
}

export interface CommandOption {
  id: string
  title: string
  description?: string
  category?: string
  keybind?: KeybindConfig
  slash?: string
  slashArguments?: boolean
  suggested?: boolean
  disabled?: boolean
  hidden?: boolean
  when?: (event: KeyboardEvent) => boolean
  onSelect?: (source?: "palette" | "keybind" | "slash", input?: string) => void | Promise<void>
  onHighlight?: () => (() => void) | void
}

export function commandPaletteOptions(options: CommandOption[]) {
  return options.filter(
    (option) =>
      !option.disabled && !option.hidden && !option.id.startsWith(SUGGESTED_PREFIX) && option.id !== "file.open",
  )
}

export function resolveKeybindOption(candidates: CommandOption[] | undefined, event: KeyboardEvent) {
  return candidates?.find((option) => option.when?.(event)) ?? candidates?.find((option) => !option.when)
}

type CommandSource = "palette" | "keybind" | "slash"

export const CommandCatalogItem = Persistence.struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  keybind: Schema.optional(Schema.String),
  slash: Schema.optional(Schema.String),
  hidden: Schema.optional(Schema.Boolean),
})
export type CommandCatalogItem = typeof CommandCatalogItem.Type
export const CommandCatalog = Schema.Record(Schema.String, Schema.mutableKey(CommandCatalogItem))
export type CommandCatalog = typeof CommandCatalog.Type

export type CommandRegistration = {
  key?: string
  options: Accessor<CommandOption[]>
}

export function addCommandRegistration(registrations: CommandRegistration[], entry: CommandRegistration) {
  return [entry, ...registrations]
}

export function activeCommandRegistrations(registrations: CommandRegistration[]) {
  const keys = new Set<string>()
  return registrations.filter((entry) => {
    if (entry.key === undefined) return true
    if (keys.has(entry.key)) return false
    keys.add(entry.key)
    return true
  })
}

export const { use: useCommand, provider: CommandProvider } = createSimpleContext({
  name: "Command",
  init: () => {
    const dialog = useDialog()
    const settings = useSettings()
    const language = useLanguage()
    const [store, setStore] = createStore({
      registrations: [] as CommandRegistration[],
      suspendCount: 0,
    })
    const warnedDuplicates = new Set<string>()

    const [catalog, setCatalog, _, catalogReady] = persisted(Persist.global("command.catalog.v1"), CommandCatalog, {})

    const bind = (id: string, def: KeybindConfig | undefined) => {
      const custom = settings.keybinds.get(actionId(id))
      const config = custom ?? def
      if (!config || config === "none") return
      return config
    }

    const registered = createMemo(() => {
      const seen = new Set<string>()
      const all: CommandOption[] = []

      for (const reg of activeCommandRegistrations(store.registrations)) {
        for (const opt of reg.options()) {
          if (seen.has(opt.id)) {
            if (import.meta.env.DEV && !warnedDuplicates.has(opt.id)) {
              warnedDuplicates.add(opt.id)
              console.warn(`[command] duplicate command id "${opt.id}" registered; keeping first entry`)
            }
            continue
          }
          seen.add(opt.id)
          all.push(opt)
        }
      }

      return all
    })

    createEffect(() => {
      if (!catalogReady()) return

      batch(() =>
        registered().forEach((opt) => {
          if (!opt.title) return
          setCatalog(
            actionId(opt.id),
            reconcile({
              title: opt.title,
              description: opt.description,
              category: opt.category,
              keybind: opt.keybind,
              slash: opt.slash,
            }),
          )
        }),
      )
    })

    const catalogOptions = createMemo(() => Object.entries(catalog).map(([id, meta]) => ({ id, ...meta })))

    const options = createMemo(() => {
      const resolved = registered().map((opt) => ({
        ...opt,
        keybind: bind(opt.id, opt.keybind),
      }))

      const suggested = resolved.filter((x) => x.suggested && !x.disabled)

      return [
        ...suggested.map((x) => ({
          ...x,
          id: SUGGESTED_PREFIX + x.id,
          category: language.t("command.category.suggested"),
        })),
        ...resolved,
      ]
    })

    const suspended = () => store.suspendCount > 0

    const palette = createMemo(() => {
      const config = settings.keybinds.get(PALETTE_ID) ?? DEFAULT_PALETTE_KEYBIND
      const keybinds = parseKeybind(config)
      return new Set(keybinds.map((kb) => signature(kb.key, kb.ctrl, kb.meta, kb.shift, kb.alt)))
    })

    const keymap = createMemo(() => {
      const map = new Map<string, CommandOption[]>()
      for (const option of options()) {
        if (option.id.startsWith(SUGGESTED_PREFIX)) continue
        if (option.disabled) continue
        if (!option.keybind) continue

        const keybinds = parseKeybind(option.keybind)
        for (const kb of keybinds) {
          if (!kb.key) continue
          const sig = signature(kb.key, kb.ctrl, kb.meta, kb.shift, kb.alt)
          const existing = map.get(sig)
          if (existing) {
            existing.push(option)
            continue
          }
          map.set(sig, [option])
        }
      }
      return map
    })

    const optionMap = createMemo(() => {
      const map = new Map<string, CommandOption>()
      for (const option of options()) {
        map.set(option.id, option)
        map.set(actionId(option.id), option)
      }
      return map
    })

    const run = (id: string, source?: CommandSource, input?: string) => {
      const option = optionMap().get(id)
      return option?.onSelect?.(source, input)
    }

    const showPalette = () => {
      run(PALETTE_ID, "palette")
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (suspended() || dialog.active) return

      const sig = signatureFromEvent(event)
      const isPalette = palette().has(sig)
      const option = resolveKeybindOption(keymap().get(sig), event)
      const modified = event.ctrlKey || event.metaKey || event.altKey
      const isTab = event.key === "Tab"

      if (isEditableTarget(event.target) && !isPalette && !isAllowedEditableKeybind(option?.id) && !modified && !isTab)
        return

      if (isPalette) {
        event.preventDefault()
        event.stopPropagation()
        showPalette()
        return
      }

      if (!option) return
      event.preventDefault()
      event.stopPropagation()
      void option.onSelect?.("keybind")
    }

    onMount(() => {
      makeEventListener(document, "keydown", handleKeyDown, { capture: true })
    })

    function register(cb: () => CommandOption[]): void
    function register(key: string, cb: () => CommandOption[]): void
    function register(key: string | (() => CommandOption[]), cb?: () => CommandOption[]) {
      const id = typeof key === "string" ? key : undefined
      const next = typeof key === "function" ? key : cb
      if (!next) return
      const options = createMemo(next)
      const entry: CommandRegistration = {
        key: id,
        options,
      }
      // Register only committed owners. Updating the registry during a transition
      // can restore its pending snapshot after the outgoing owner's cleanup.
      onMount(() => setStore("registrations", (arr) => addCommandRegistration(arr, entry)))
      onCleanup(() => {
        setStore("registrations", (arr) => arr.filter((x) => x !== entry))
      })
    }

    const keybindConfig = (id: string) => {
      if (id === PALETTE_ID) return settings.keybinds.get(PALETTE_ID) ?? DEFAULT_PALETTE_KEYBIND
      const base = actionId(id)
      const live = options().find((x) => actionId(x.id) === base)
      if (live) return live.keybind
      return bind(base, catalog[base]?.keybind)
    }

    return {
      register,
      trigger(id: string, source?: CommandSource, input?: string) {
        return run(id, source, input)
      },
      keybind(id: string) {
        const config = keybindConfig(id)
        if (!config) return ""
        return formatKeybind(config, language.t)
      },
      keybindParts(id: string) {
        const config = keybindConfig(id)
        return config ? formatKeybindParts(config, language.t) : []
      },
      show: showPalette,
      keybinds(enabled: boolean) {
        setStore("suspendCount", (count) => Math.max(0, count + (enabled ? -1 : 1)))
      },
      suspended,
      get catalog() {
        return catalogOptions()
      },
      get options() {
        return options()
      },
    }
  },
})
