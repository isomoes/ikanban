import assert from 'node:assert/strict'
import test from 'node:test'

import { HISTORY_ARROW_STEP, historyScrollDelta, isHistoryNavigationKey } from '../src/client/ui-conversation/client/chat/history-keyboard.ts'

test('arrow keys move conversation history by one stable step', () => {
  assert.equal(historyScrollDelta('ArrowUp', 800), -HISTORY_ARROW_STEP)
  assert.equal(historyScrollDelta('ArrowDown', 800), HISTORY_ARROW_STEP)
})

test('page keys move conversation history by nearly one viewport', () => {
  assert.equal(historyScrollDelta('PageUp', 800), -760)
  assert.equal(historyScrollDelta('PageDown', 800), 760)
  assert.equal(historyScrollDelta('PageDown', 20), HISTORY_ARROW_STEP)
})

test('all navigation keys can be recognized for unfocused history navigation', () => {
  assert.equal(isHistoryNavigationKey('PageUp'), true)
  assert.equal(isHistoryNavigationKey('PageDown'), true)
  assert.equal(isHistoryNavigationKey('ArrowUp'), true)
  assert.equal(isHistoryNavigationKey('ArrowDown'), true)
  assert.equal(isHistoryNavigationKey('Home'), false)
})

test('unrelated keys do not move conversation history', () => {
  assert.equal(historyScrollDelta('Home', 800), null)
})
