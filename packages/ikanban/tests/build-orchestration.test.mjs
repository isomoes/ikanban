import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const readManifest = async (url) => JSON.parse(await readFile(url, 'utf8'))

test('build lifecycles produce private Web UI artifacts without recursive orchestration', async () => {
  const [root, ikanban, webUi] = await Promise.all([
    readManifest(new URL('../../../package.json', import.meta.url)),
    readManifest(new URL('../package.json', import.meta.url)),
    readManifest(new URL('../../web-ui/package.json', import.meta.url)),
  ])

  assert.equal(root.scripts.build, 'pnpm -r --if-present run build:package')
  assert.equal(webUi.scripts.build, 'pnpm build:package')
  assert.ok(webUi.scripts['build:package'])
  assert.equal(
    ikanban.scripts.build,
    'pnpm --filter @isomoes/dsh-ikanban-web-ui build:package && pnpm build:package',
  )
  assert.ok(ikanban.scripts['build:package'])
  assert.doesNotMatch(ikanban.scripts['build:package'], /(?:^|\s)pnpm build(?:\s|$)/)
})
