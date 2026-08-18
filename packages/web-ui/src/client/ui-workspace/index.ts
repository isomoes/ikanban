import { execFile } from 'node:child_process'
import { opendir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { fuzzyWorkspaceFiles } from './file-fuzzy.ts'

export const WORKSPACE_FILE_CHANNEL = '/ikanban.workspace-files'
const CATALOG_LIMIT = 20_000

export { fuzzyWorkspaceFiles } from './file-fuzzy.ts'
export { nextSessionAfterArchive } from './session-navigation.ts'

function gitFiles(cwd: string, signal: AbortSignal): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(
      'git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { cwd, encoding: 'buffer', maxBuffer: 8 * 1024 * 1024, signal },
      (error, stdout) => {
        if (error !== null) reject(error)
        else resolve(stdout.toString().split('\0').filter(Boolean))
      },
    )
  })
}

async function directoryFiles(cwd: string, signal: AbortSignal): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string): Promise<void> => {
    const entries = await opendir(directory)
    for await (const entry of entries) {
      signal.throwIfAborted()
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) files.push(relative(cwd, path).split(sep).join('/'))
    }
  }
  await visit(cwd)
  return files
}

/** Search workspace files by relative path, respecting gitignore when available. */
export async function listWorkspaceFiles(cwd: string, signal: AbortSignal): Promise<string[]> {
  const files = await gitFiles(cwd, signal).catch((error: unknown) => {
    if (signal.aborted) throw error
    return directoryFiles(cwd, signal)
  })
  return files.sort((left, right) => left.localeCompare(right)).slice(0, CATALOG_LIMIT)
}

export async function searchWorkspaceFiles(cwd: string, query: string, signal: AbortSignal): Promise<string[]> {
  return fuzzyWorkspaceFiles(await listWorkspaceFiles(cwd, signal), query)
}

export const inject = ['connection', 'workspaceRegistry']

export function apply(ctx: Context): void {
  const workspaceRegistry = ctx.get('workspaceRegistry') as { list(): readonly { path: string }[] }
  ctx.effect(() => ctx.connection.rpc.handle(WORKSPACE_FILE_CHANNEL, async (endpoint, payload, signal) => {
    if (endpoint !== 'search' || typeof payload !== 'object' || payload === null) {
      return { ok: false, error: { code: 'internal', message: 'Invalid workspace file search request', details: {} } }
    }
    const { cwd, query } = payload as Record<string, unknown>
    if (typeof cwd !== 'string' || cwd === '' || query !== '') {
      return { ok: false, error: { code: 'internal', message: 'Invalid workspace file search request', details: {} } }
    }
    if (!workspaceRegistry.list().some(workspace => workspace.path === cwd)) {
      return { ok: false, error: { code: 'internal', message: 'Unknown workspace', details: {} } }
    }
    try {
      return { ok: true, value: await listWorkspaceFiles(cwd, signal) }
    } catch (error) {
      return {
        ok: false,
        error: { code: 'internal', message: error instanceof Error ? error.message : 'Workspace file search failed', details: {} },
      }
    }
  }, { authority: 'trusted-host' }), 'ui-workspace: file search RPC')
}
