import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

test('frontend build emits local hashed assets', async () => {
  const index = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
  assert.match(index, /\/assets\//)

  const assets = await readdir(new URL('../dist/assets', import.meta.url), { recursive: true })
  const scripts = assets.filter(file => file.endsWith('.js'))
  assert.ok(scripts.length > 0, 'expected emitted JavaScript assets')

  for (const script of scripts) {
    const source = await readFile(`${packageRoot}/dist/assets/${script}`, 'utf8')
    assert.doesNotMatch(source, /\.\.\/deepseek-harness/)
  }
})
