import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  apply,
  SESSION_REFERENCE_DEBOUNCE_MS,
} from '../src/client/ui-reference/client/index.ts'

function installSources({ fileList, sessionList }) {
  const sources = []
  const ctx = {
    locale: {
      register: () => () => {},
      bind: () => key => key,
    },
    remote: {
      fileReferences: { list: fileList },
      sessionReferenceResolver: { candidates: sessionList },
    },
    effect(setup) {
      setup()
    },
    get(name) {
      assert.equal(name, 'inputTriggers')
      return {
        registerSource(source) {
          sources.push(source)
          return () => {}
        },
      }
    },
  }
  apply(ctx)
  return sources
}

const request = signal => ({
  query: 'app',
  quoted: false,
  position: 'inline',
  signal,
})

test('file references settle independently of debounced session discovery', async () => {
  let sessionCalls = 0
  const sources = installSources({
    fileList: async () => ({ ok: true, value: [{ path: 'src/app.ts', kind: 'file' }] }),
    sessionList: async () => {
      sessionCalls += 1
      return { ok: true, value: [] }
    },
  })
  assert.deepEqual(sources.map(source => source.name), ['reference', 'reference-sessions'])

  const signal = new AbortController().signal
  const sessionPromise = sources[1].candidates({ sessionId: 'current' }, request(signal))
  const files = await sources[0].candidates({ sessionId: 'current' }, request(signal))

  assert.equal(files.length, 1)
  assert.equal(files[0].section, 'section.files')
  assert.equal(sessionCalls, 0)
  await sessionPromise
  assert.equal(sessionCalls, 1)
})

test('superseded session discovery aborts during debounce without a Host call', async () => {
  let sessionCalls = 0
  const sources = installSources({
    fileList: async () => ({ ok: true, value: [] }),
    sessionList: async () => {
      sessionCalls += 1
      return { ok: true, value: [] }
    },
  })
  const controller = new AbortController()
  const pending = sources[1].candidates({ sessionId: 'current' }, request(controller.signal))
  controller.abort(new Error('superseded'))

  await assert.rejects(pending, /superseded/)
  assert.equal(sessionCalls, 0)
  assert.equal(SESSION_REFERENCE_DEBOUNCE_MS, 150)
})
