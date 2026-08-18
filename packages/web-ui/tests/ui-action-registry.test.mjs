import assert from 'node:assert/strict'
import test from 'node:test'

import {
  UiActionRegistry,
  filterUiActions,
  formatKeybind,
  keybindFromEvent,
  matchKeybind,
  parseKeybind,
} from '../src/client/ui-commands/client/actions.ts'
import {
  decodeStoredKeybinds,
  readStoredKeybinds,
  SHORTCUT_STORAGE_KEY,
  writeStoredKeybinds,
} from '../src/client/ui-commands/client/shortcut-storage.ts'

test('filters enabled palette actions across title, description, and category', () => {
  const actions = [
    { id: 'sidebar.toggle', title: () => 'Toggle sidebar', category: () => 'View', run() {} },
    { id: 'session.new', title: () => 'New session', description: () => 'Start in a workspace', run() {} },
    { id: 'workspace.delete', title: () => 'Delete Workspace', run() {} },
    { id: 'settings.open', title: () => 'Settings', disabled: () => true, run() {} },
  ]

  assert.deepEqual(filterUiActions(actions, 'view').map(action => action.id), ['sidebar.toggle'])
  assert.deepEqual(filterUiActions(actions, 'workspace').map(action => action.id), ['session.new', 'workspace.delete'])
  assert.deepEqual(filterUiActions(actions, '').map(action => action.id), ['sidebar.toggle', 'session.new', 'workspace.delete'])
})

test('fuzzy matches action text and multi-word initials', () => {
  const actions = [
    { id: 'sidebar.toggle', title: () => 'Toggle sidebar', run() {} },
    { id: 'workspace.delete', title: () => 'Delete Workspace', run() {} },
  ]

  assert.deepEqual(filterUiActions(actions, 'dw').map(action => action.id), ['workspace.delete'])
  assert.deepEqual(filterUiActions(actions, 'tgsi').map(action => action.id), ['sidebar.toggle'])
})

test('parses mod aliases and formats the platform key', () => {
  assert.deepEqual(parseKeybind('mod+shift+p, alt+arrowdown', false), [
    { key: 'p', ctrl: true, meta: false, shift: true, alt: false },
    { key: 'arrowdown', ctrl: false, meta: false, shift: false, alt: true },
  ])
  assert.equal(formatKeybind('mod+comma', false), 'Ctrl+,')
  assert.equal(formatKeybind('mod+comma', true), '⌘,')
})

test('serializes captured shortcuts and ignores modifier-only keys', () => {
  assert.equal(keybindFromEvent(keyboardEvent('K', { ctrlKey: true, shiftKey: true })), 'ctrl+shift+k')
  assert.equal(keybindFromEvent(keyboardEvent(',', { metaKey: true })), 'meta+comma')
  assert.equal(keybindFromEvent(keyboardEvent('Control', { ctrlKey: true })), undefined)
})

test('matches punctuation and exact modifiers', () => {
  const keybinds = parseKeybind('ctrl+comma', false)
  assert.equal(matchKeybind(keybinds, { key: ',', ctrlKey: true }), true)
  assert.equal(matchKeybind(keybinds, { key: ',', ctrlKey: true, altKey: true }), false)
})

test('registers actions until disposal and rejects duplicate ids', () => {
  const registry = new UiActionRegistry(false)
  const dispose = registry.register({ id: 'sidebar.toggle', title: () => 'Toggle sidebar', run() {} })

  assert.deepEqual(registry.getSnapshot().map(action => action.id), ['sidebar.toggle'])
  assert.throws(
    () => registry.register({ id: 'sidebar.toggle', title: () => 'Duplicate', run() {} }),
    /duplicate local action "sidebar\.toggle"/,
  )

  dispose()
  assert.deepEqual(registry.getSnapshot(), [])
})

test('does not run disabled actions', () => {
  const registry = new UiActionRegistry(false)
  let runs = 0
  registry.register({
    id: 'session.next',
    title: () => 'Next session',
    disabled: () => true,
    run() { runs += 1 },
  })

  assert.equal(registry.trigger('session.next', 'palette'), false)
  assert.equal(runs, 0)
})

test('opens the palette and dispatches registered shortcuts', () => {
  const registry = new UiActionRegistry(false)
  const sources = []
  registry.register({
    id: 'sidebar.toggle',
    title: () => 'Toggle sidebar',
    keybind: 'mod+l',
    run(source) { sources.push(source) },
  })

  const oldPaletteEvent = keyboardEvent('P', { ctrlKey: true, shiftKey: true })
  assert.equal(registry.handleKeyDown(oldPaletteEvent), false)

  const paletteEvent = keyboardEvent('P', { ctrlKey: true })
  assert.equal(registry.handleKeyDown(paletteEvent), true)
  assert.equal(registry.getPaletteSnapshot(), true)
  assert.equal(paletteEvent.defaultPrevented, true)

  registry.closePalette()
  const actionEvent = keyboardEvent('l', { ctrlKey: true })
  assert.equal(registry.handleKeyDown(actionEvent), true)
  assert.deepEqual(sources, ['keybind'])
})

test('applies profile overrides to actions and the palette shortcut', () => {
  const registry = new UiActionRegistry(false)
  let runs = 0
  registry.register({ id: 'session.new', title: () => 'New session', keybind: 'ctrl+n', run() { runs += 1 } })
  registry.setKeybindOverrides({ 'session.new': 'alt+n', 'command.palette': 'ctrl+k' })

  assert.equal(registry.getSnapshot()[0]?.keybind, 'alt+n')
  assert.equal(registry.getDefaultKeybind('session.new'), 'ctrl+n')
  assert.equal(registry.getKeybind('command.palette'), 'ctrl+k')
  assert.equal(registry.hasKeybindOverride('session.new'), true)
  assert.equal(registry.handleKeyDown(keyboardEvent('n', { ctrlKey: true })), false)
  assert.equal(registry.handleKeyDown(keyboardEvent('n', { altKey: true })), true)
  assert.equal(runs, 1)
  assert.equal(registry.handleKeyDown(keyboardEvent('p', { ctrlKey: true })), false)
  assert.equal(registry.handleKeyDown(keyboardEvent('k', { ctrlKey: true })), true)
  assert.equal(registry.getPaletteSnapshot(), true)

  registry.setKeybindOverrides({})
  assert.equal(registry.getSnapshot()[0]?.keybind, 'ctrl+n')
  assert.equal(registry.hasKeybindOverride('session.new'), false)
  assert.equal(registry.getKeybind('command.palette'), 'mod+p')
})

test('none disables profile-overridden action and palette shortcuts', () => {
  const registry = new UiActionRegistry(false)
  let runs = 0
  registry.register({ id: 'session.new', title: () => 'New session', keybind: 'ctrl+n', run() { runs += 1 } })
  registry.setKeybindOverrides({ 'session.new': 'none', 'command.palette': 'none' })

  assert.equal(registry.getSnapshot()[0]?.keybind, 'none')
  assert.equal(registry.handleKeyDown(keyboardEvent('n', { ctrlKey: true })), false)
  assert.equal(registry.handleKeyDown(keyboardEvent('p', { ctrlKey: true })), false)
  assert.equal(runs, 0)
})

test('persists valid shortcut maps in browser storage and rejects malformed entries', () => {
  const values = new Map()
  const storage = {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
  }
  const keybinds = { 'command.palette': 'ctrl+k', 'session.new': 'none' }

  assert.equal(writeStoredKeybinds(keybinds, storage), true)
  assert.equal(values.has(SHORTCUT_STORAGE_KEY), true)
  assert.deepEqual(readStoredKeybinds(storage), keybinds)
  assert.deepEqual(decodeStoredKeybinds('{"valid":"ctrl+v","invalid":2}'), { valid: 'ctrl+v' })
  assert.deepEqual(decodeStoredKeybinds('{broken'), {})
  assert.equal(writeStoredKeybinds(keybinds, { getItem() { return null }, setItem() { throw new Error('denied') } }), false)
})

test('leaves unmodified shortcuts alone in editable controls', () => {
  const registry = new UiActionRegistry(false)
  let runs = 0
  registry.register({ id: 'example', title: () => 'Example', keybind: 'x', run() { runs += 1 } })
  const event = keyboardEvent('x', { editable: true })

  assert.equal(registry.handleKeyDown(event), false)
  assert.equal(event.defaultPrevented, false)
  assert.equal(runs, 0)
})

function keyboardEvent(key, options = {}) {
  let prevented = false
  return {
    key,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
    target: options.editable ? { matches: selector => selector === 'input, textarea, select, [contenteditable="true"]' } : null,
    get defaultPrevented() { return prevented },
    preventDefault() { prevented = true },
  }
}
