import assert from 'node:assert/strict'
import { test } from 'node:test'

const row = (id, running, pendingInteraction, origin) => ({
  id,
  running,
  ...(pendingInteraction === undefined ? {} : { pendingInteraction }),
  ...(origin === undefined ? {} : { origin }),
})

test('reminder observer primes without replaying stale state', async () => {
  const { SessionReminderObserver } = await import('../lib/clients/ui-reminders/index.js')
  const observer = new SessionReminderObserver()
  assert.deepEqual(observer.update([
    row('idle', false),
    row('waiting', true, 'approval'),
  ]), [])
})

test('reminder observer detects finish and every DSH interaction wait', async () => {
  const { SessionReminderObserver } = await import('../lib/clients/ui-reminders/index.js')
  const observer = new SessionReminderObserver()
  observer.update([
    row('finished', true),
    row('approval', true),
    row('plan', true),
    row('question', true),
  ])
  assert.deepEqual(observer.update([
    row('finished', false),
    row('approval', true, 'approval'),
    row('plan', true, 'plan-review'),
    row('question', true, 'question'),
  ]), [
    { kind: 'completion', sessionId: 'finished' },
    { kind: 'attention', sessionId: 'approval' },
    { kind: 'attention', sessionId: 'plan' },
    { kind: 'attention', sessionId: 'question' },
  ])
})

test('attention wins a simultaneous edge and reconnect replay is cooled down', async () => {
  const { SessionReminderObserver } = await import('../lib/clients/ui-reminders/index.js')
  let now = 10_000
  const observer = new SessionReminderObserver(() => now, 5_000)
  observer.update([row('session', true)])
  assert.deepEqual(observer.update([row('session', false, 'approval')]), [
    { kind: 'attention', sessionId: 'session' },
  ])
  observer.update([row('session', false)])
  now += 1_000
  assert.deepEqual(observer.update([row('session', false, 'approval')]), [])
  observer.update([row('session', false)])
  now += 5_000
  assert.deepEqual(observer.update([row('session', false, 'question')]), [
    { kind: 'attention', sessionId: 'session' },
  ])
})

test('subagent and newly arrived sessions remain quiet', async () => {
  const { SessionReminderObserver } = await import('../lib/clients/ui-reminders/index.js')
  const observer = new SessionReminderObserver()
  observer.update([row('child', true, undefined, 'subagent')])
  assert.deepEqual(observer.update([
    row('child', false, 'approval', 'subagent'),
    row('new', false, 'question'),
  ]), [])
})
