/** Browser-local durability used when the Host settings namespace is unavailable. */
export const SHORTCUT_STORAGE_KEY = 'dsh.ui-commands.keybinds.v1'

export type KeybindMap = Record<string, string>

type StorageFace = Pick<Storage, 'getItem' | 'setItem'>

/** Narrow untrusted JSON into the shortcut dictionary shape. */
export function decodeStoredKeybinds(raw: string | null): KeybindMap {
  if (raw === null) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    const result: KeybindMap = {}
    for (const [id, keybind] of Object.entries(value)) {
      if (typeof keybind === 'string') result[id] = keybind
    }
    return result
  } catch (_malformedJson) {
    return {}
  }
}

/** Read browser overrides without letting denied storage break the command service. */
export function readStoredKeybinds(storage: StorageFace | undefined = browserStorage()): KeybindMap {
  if (storage === undefined) return {}
  try {
    return decodeStoredKeybinds(storage.getItem(SHORTCUT_STORAGE_KEY))
  } catch (_storageDenied) {
    return {}
  }
}

/** Mirror overrides to browser storage; false means persistence was denied. */
export function writeStoredKeybinds(
  keybinds: KeybindMap,
  storage: StorageFace | undefined = browserStorage(),
): boolean {
  if (storage === undefined) return false
  try {
    storage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(keybinds))
    return true
  } catch (_storageDenied) {
    return false
  }
}

function browserStorage(): StorageFace | undefined {
  try {
    return typeof localStorage === 'object' ? localStorage : undefined
  } catch (_storageDenied) {
    return undefined
  }
}
