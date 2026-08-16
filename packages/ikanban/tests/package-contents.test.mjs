import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { test } from 'node:test'

const execFileAsync = promisify(execFile)
const packageRoot = new URL('../', import.meta.url)

test('publishes runnable bundles without JavaScript source maps', async () => {
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: packageRoot },
  )
  const [{ files }] = JSON.parse(stdout)
  const paths = files.map(file => file.path)

  assert(paths.includes('lib/index.js'))
  assert(paths.includes('lib/web/index.html'))
  assert(paths.includes('lib/clients/locale/client.js'))
  assert(!paths.some(path => path.endsWith('.js.map')))
})
