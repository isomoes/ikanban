import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

test('frontend build emits local hashed assets', async () => {
  const index = await readFile(new URL('../web/index.html', import.meta.url), 'utf8')
  assert.match(index, /\/assets\//)

  const assets = await readdir(new URL('../web/assets', import.meta.url), { recursive: true })
  const scripts = assets.filter(file => file.endsWith('.js'))
  assert.ok(scripts.length > 0, 'expected emitted JavaScript assets')

  for (const script of scripts) {
    const source = await readFile(`${packageRoot}/web/assets/${script}`, 'utf8')
    assert.doesNotMatch(source, /\.\.\/deepseek-harness/)
    assert.doesNotMatch(
      source,
      /window\.__ModuleLoader__\.load\(\{/,
      'the shell must bundle the module-system source, not its runtime plugin wrapper',
    )
  }
})
