import { access, readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const STOCK_PREFIX = '@deepseek-ai/dsh-client-'
const VIRTUAL_PREFIX = '@isomoes/dsh-ikanban/client/'

// Local cross-plugin collaborations added since the pinned upstream fork.
// Keep only metadata differences here; the stock manifests own every other row.
const CLIENT_INJECT_OVERRIDES = {
  'ui-sidebar': [
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-commands',
  ],
  'ui-settings-general': [
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-settings',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-api-remotes',
    '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-commands',
  ],
  'ui-workspace': [
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-input-trigger',
    '@deepseek-ai/dsh-client-ui-sidebar',
  ],
  'ui-commands': [
    '@deepseek-ai/dsh-api-remotes',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-input-trigger',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-layout',
  ],
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function sourceEntries(sourceRoot, parent, excluded = new Set()) {
  const root = resolve(sourceRoot, parent)
  const directories = await readdir(root, { withFileTypes: true })
  const entries = []
  for (const directory of directories) {
    if (!directory.isDirectory() || excluded.has(directory.name)) continue
    const source = resolve(root, directory.name, 'client/index.ts')
    if (!await exists(source)) continue
    entries.push({ id: directory.name, source })
  }
  return entries
}

/**
 * Discover the complete locally owned client surface from source conventions.
 * Upstream package manifests remain the authority for Loader ordering metadata.
 */
export async function discoverClientEntries({ packageRoot, upstreamAnchor }) {
  const sourceRoot = resolve(packageRoot, 'src')
  const discovered = [
    ...await sourceEntries(sourceRoot, 'client', new Set(['modules'])),
    ...await sourceEntries(sourceRoot, 'extensions'),
  ].sort((left, right) => left.id.localeCompare(right.id))

  const upstreamRequire = createRequire(upstreamAnchor)
  const webAppManifest = upstreamRequire.resolve('@deepseek-ai/dsh-web-app/package.json')
  const webAppRequire = createRequire(webAppManifest)
  const entries = []

  for (const item of discovered) {
    const stockId = `${STOCK_PREFIX}${item.id}`
    const stockManifest = webAppRequire(`${stockId}/package.json`)
    if (stockManifest.dsh?.client === undefined) {
      throw new Error(`${stockId} does not declare dsh.client metadata`)
    }

    const hostCandidate = resolve(sourceRoot, 'client', item.id, 'index.ts')
    let host
    if (await exists(hostCandidate)) {
      const hostSource = await readFile(hostCandidate, 'utf8')
      if (/^import\s|\sfrom\s+['"]/m.test(hostSource)) host = hostCandidate
    }

    const inject = CLIENT_INJECT_OVERRIDES[item.id]
    const client = inject === undefined
      ? stockManifest.dsh.client
      : { ...stockManifest.dsh.client, inject }
    entries.push({
      id: item.id,
      stockId,
      virtualId: `${VIRTUAL_PREFIX}${item.id}`,
      source: item.source,
      ...(host === undefined ? {} : { host }),
      client,
    })
  }

  return entries
}
