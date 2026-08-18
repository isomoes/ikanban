import type { CommandSettings } from '../shortcut-settings.ts'

export type UiActionSource = 'palette' | 'keybind' | 'api'

/** Settings dictionary key for the command-palette shortcut itself. */
export const COMMAND_PALETTE_ACTION_ID = 'command.palette'

const DEFAULT_PALETTE_KEYBIND = 'mod+p'

export interface UiAction {
  readonly id: string
  readonly title: () => string
  readonly description?: () => string
  readonly category?: () => string
  readonly keybind?: string
  readonly disabled?: () => boolean
  readonly run: (source: UiActionSource) => void | Promise<void>
}

export interface ParsedKeybind {
  readonly key: string
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
  readonly alt: boolean
}

type KeyboardEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'target' | 'preventDefault'>
  & Partial<Pick<KeyboardEvent, 'defaultPrevented'>>

function normalizeKey(key: string): string {
  if (key === ',') return 'comma'
  if (key === '+') return 'plus'
  if (key === ' ') return 'space'
  return key.toLowerCase()
}

export function parseKeybind(config: string, mac: boolean): ParsedKeybind[] {
  if (config === '' || config === 'none') return []
  return config.split(',').map((combo) => {
    let key = ''
    let ctrl = false
    let meta = false
    let shift = false
    let alt = false
    for (const part of combo.trim().toLowerCase().split('+')) {
      if (part === 'ctrl' || part === 'control') ctrl = true
      else if (part === 'meta' || part === 'cmd' || part === 'command') meta = true
      else if (part === 'mod') mac ? meta = true : ctrl = true
      else if (part === 'shift') shift = true
      else if (part === 'alt' || part === 'option') alt = true
      else key = part
    }
    return { key, ctrl, meta, shift, alt }
  })
}

export function matchKeybind(keybinds: readonly ParsedKeybind[], event: KeyboardEventLike): boolean {
  const key = normalizeKey(event.key)
  return keybinds.some(binding => binding.key === key
    && binding.ctrl === Boolean(event.ctrlKey)
    && binding.meta === Boolean(event.metaKey)
    && binding.shift === Boolean(event.shiftKey)
    && binding.alt === Boolean(event.altKey))
}

/** Convert a concrete keyboard gesture into a storable keybind string. */
export function keybindFromEvent(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): string | undefined {
  const key = normalizeKey(event.key)
  if (key === '' || key === 'control' || key === 'ctrl' || key === 'meta'
    || key === 'shift' || key === 'alt' || key === 'option' || key === 'dead') return undefined
  const parts: string[] = []
  if (event.ctrlKey) parts.push('ctrl')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  if (event.metaKey) parts.push('meta')
  parts.push(key)
  return parts.join('+')
}

export function formatKeybind(config: string, mac: boolean): string {
  const binding = parseKeybind(config, mac)[0]
  if (binding === undefined) return ''
  const parts: string[] = []
  if (binding.ctrl) parts.push(mac ? '⌃' : 'Ctrl')
  if (binding.alt) parts.push(mac ? '⌥' : 'Alt')
  if (binding.shift) parts.push(mac ? '⇧' : 'Shift')
  if (binding.meta) parts.push(mac ? '⌘' : 'Meta')
  const labels: Record<string, string> = {
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    comma: ',',
    plus: '+',
    space: 'Space',
  }
  if (binding.key !== '') {
    parts.push(labels[binding.key] ?? (binding.key.length === 1
      ? binding.key.toUpperCase()
      : binding.key.charAt(0).toUpperCase() + binding.key.slice(1)))
  }
  return mac ? parts.join('') : parts.join('+')
}

function fuzzyActionMatch(value: string, query: string): boolean {
  const haystack = value.toLocaleLowerCase()
  if (haystack.includes(query)) return true

  const words = haystack.match(/[\p{L}\p{N}]+/gu) ?? []
  const initials = words.map(word => word[0]).join('')
  const compactNeedle = query.replace(/[^\p{L}\p{N}]/gu, '')
  if (compactNeedle === '') return false
  if (initials.includes(compactNeedle)) return true

  const compactHaystack = words.join('')
  let needleIndex = 0
  for (const character of compactHaystack) {
    if (character === compactNeedle[needleIndex]) needleIndex += 1
    if (needleIndex === compactNeedle.length) return true
  }
  return false
}

export function filterUiActions(actions: readonly UiAction[], query: string): readonly UiAction[] {
  const needle = query.trim().toLocaleLowerCase()
  return actions.filter((action) => {
    if (action.disabled?.() === true) return false
    if (needle === '') return true
    return [action.title(), action.description?.() ?? '', action.category?.() ?? '']
      .some(value => fuzzyActionMatch(value, needle))
  })
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false
  const candidate = target as { matches?: (selector: string) => boolean; closest?: (selector: string) => unknown }
  const selector = 'input, textarea, select, [contenteditable="true"]'
  return candidate.matches?.(selector) === true || candidate.closest?.(selector) != null
}

function platformIsMac(): boolean {
  return typeof navigator === 'object' && /Mac|iPod|iPhone|iPad/u.test(navigator.platform)
}

export class UiActionRegistry {
  readonly mac: boolean
  private readonly actions = new Map<string, UiAction>()
  private readonly actionListeners = new Set<() => void>()
  private readonly paletteListeners = new Set<() => void>()
  private snapshot: readonly UiAction[] = []
  private paletteOpen = false
  private keybindOverrides: CommandSettings['keybinds'] = {}

  constructor(mac = platformIsMac()) {
    this.mac = mac
  }

  /** Replace profile overrides and republish effective action shortcuts. */
  setKeybindOverrides(overrides: CommandSettings['keybinds']): void {
    this.keybindOverrides = { ...overrides }
    this.publishActions()
  }

  /** Resolve one action's current effective shortcut, including the palette. */
  getKeybind(id: string): string | undefined {
    const override = this.keybindOverrides[id]
    if (override !== undefined) return override
    if (id === COMMAND_PALETTE_ACTION_ID) return DEFAULT_PALETTE_KEYBIND
    return this.actions.get(id)?.keybind
  }

  /** Resolve the built-in shortcut used when no profile override exists. */
  getDefaultKeybind(id: string): string | undefined {
    return id === COMMAND_PALETTE_ACTION_ID ? DEFAULT_PALETTE_KEYBIND : this.actions.get(id)?.keybind
  }

  /** Whether the profile explicitly customizes or disables this shortcut. */
  hasKeybindOverride(id: string): boolean {
    return Object.hasOwn(this.keybindOverrides, id)
  }

  register(action: UiAction): () => void {
    if (this.actions.has(action.id)) throw new Error(`duplicate local action "${action.id}"`)
    this.actions.set(action.id, action)
    this.publishActions()
    return () => {
      if (this.actions.get(action.id) !== action) return
      this.actions.delete(action.id)
      this.publishActions()
    }
  }

  getSnapshot = (): readonly UiAction[] => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.actionListeners.add(listener)
    return () => { this.actionListeners.delete(listener) }
  }

  getPaletteSnapshot = (): boolean => this.paletteOpen

  subscribePalette = (listener: () => void): (() => void) => {
    this.paletteListeners.add(listener)
    return () => { this.paletteListeners.delete(listener) }
  }

  openPalette(): void {
    if (this.paletteOpen) return
    this.paletteOpen = true
    for (const listener of this.paletteListeners) listener()
  }

  closePalette(): void {
    if (!this.paletteOpen) return
    this.paletteOpen = false
    for (const listener of this.paletteListeners) listener()
  }

  trigger(id: string, source: UiActionSource = 'api'): boolean {
    const action = this.actions.get(id)
    if (action === undefined || action.disabled?.() === true) return false
    try {
      const result = action.run(source)
      if (result instanceof Promise) void result.catch(error => { console.error(`[ui-actions] ${id} failed:`, error) })
    } catch (error) {
      console.error(`[ui-actions] ${id} failed:`, error)
    }
    return true
  }

  handleKeyDown(event: KeyboardEventLike): boolean {
    if (event.defaultPrevented === true) return false
    const paletteKeybind = this.keybindOverrides[COMMAND_PALETTE_ACTION_ID] ?? DEFAULT_PALETTE_KEYBIND
    if (matchKeybind(parseKeybind(paletteKeybind, this.mac), event)) {
      event.preventDefault()
      this.openPalette()
      return true
    }
    const modified = Boolean(event.ctrlKey || event.metaKey || event.altKey)
    if (isEditableTarget(event.target) && !modified) return false
    for (const action of this.snapshot) {
      if (action.keybind === undefined || action.disabled?.() === true) continue
      if (!matchKeybind(parseKeybind(action.keybind, this.mac), event)) continue
      event.preventDefault()
      this.trigger(action.id, 'keybind')
      return true
    }
    return false
  }

  private publishActions(): void {
    this.snapshot = [...this.actions.values()].map((action) => {
      const override = this.keybindOverrides[action.id]
      return override === undefined ? action : { ...action, keybind: override }
    })
    for (const listener of this.actionListeners) listener()
  }
}
