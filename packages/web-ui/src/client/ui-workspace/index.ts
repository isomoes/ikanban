import { execFile } from 'node:child_process'
import { lstat, open, opendir, readlink } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { fuzzyWorkspaceFiles } from './file-fuzzy.ts'
import type {
  WorkspaceChange, WorkspaceChanges, WorkspaceChangeStatus,
} from './workspace-changes.ts'

export const WORKSPACE_FILE_CHANNEL = '/ikanban.workspace-files'
const CATALOG_LIMIT = 20_000
const CHANGES_RESPONSE_LIMIT = 8 * 1024 * 1024
const UNTRACKED_FILE_LIMIT = 512 * 1024

export { fuzzyWorkspaceFiles } from './file-fuzzy.ts'
export type { WorkspaceChange, WorkspaceChanges, WorkspaceChangeStatus } from './workspace-changes.ts'
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

function gitOutput(cwd: string, args: readonly string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', [...args], { cwd, encoding: 'buffer', maxBuffer: CHANGES_RESPONSE_LIMIT, signal }, (error, stdout) => {
      if (error !== null) reject(error)
      else resolve(stdout.toString())
    })
  })
}

interface StatusEntry {
  readonly code: string
  readonly path: string
  readonly previousPath?: string
}

function parseGitStatus(output: string): StatusEntry[] {
  const fields = output.split('\0')
  const entries: StatusEntry[] = []
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index]
    if (field === undefined || field === '') continue
    const code = field.slice(0, 2)
    const path = field.slice(3)
    if (path === '') continue
    if (code.includes('R') || code.includes('C')) {
      const previousPath = fields[++index]
      entries.push({ code, path, ...(previousPath === undefined || previousPath === '' ? {} : { previousPath }) })
    } else {
      entries.push({ code, path })
    }
  }
  return entries
}

function changeStatus(code: string): WorkspaceChangeStatus {
  if (code === '??') return 'untracked'
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflicted'
  if (code.includes('R') || code.includes('C')) return 'renamed'
  if (code.includes('D')) return 'deleted'
  if (code.includes('A')) return 'added'
  return 'modified'
}

async function untrackedPatch(cwd: string, path: string, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const absolutePath = join(cwd, path)
  const stat = await lstat(absolutePath)
  let content: Buffer
  let truncated = false
  if (stat.isSymbolicLink()) {
    content = Buffer.from(await readlink(absolutePath))
  } else {
    const handle = await open(absolutePath, 'r')
    try {
      content = Buffer.alloc(Math.min(stat.size, UNTRACKED_FILE_LIMIT + 1))
      const result = await handle.read(content, 0, content.byteLength, 0)
      content = content.subarray(0, result.bytesRead)
      truncated = stat.size > UNTRACKED_FILE_LIMIT
    } finally {
      await handle.close()
    }
  }
  if (content.includes(0)) return `diff --git a/${path} b/${path}\nnew file mode 100644\nBinary file ${path} added\n`
  const text = content.subarray(0, UNTRACKED_FILE_LIMIT).toString('utf8')
  const lines = text === '' ? [] : (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n')
  const body = lines.map(line => `+${line}`).join('\n')
  return [
    `diff --git a/${path} b/${path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    body,
    ...(truncated ? ['+… diff truncated …'] : []),
    '',
  ].join('\n')
}

async function trackedPatch(cwd: string, entry: StatusEntry, signal: AbortSignal): Promise<string> {
  const paths = entry.previousPath === undefined ? [entry.path] : [entry.previousPath, entry.path]
  try {
    return await gitOutput(cwd, ['diff', '--no-ext-diff', '--no-color', '--unified=3', 'HEAD', '--', ...paths], signal)
  } catch (error) {
    if (signal.aborted) throw error
    const [staged, unstaged] = await Promise.all([
      gitOutput(cwd, ['diff', '--no-ext-diff', '--no-color', '--unified=3', '--cached', '--', ...paths], signal),
      gitOutput(cwd, ['diff', '--no-ext-diff', '--no-color', '--unified=3', '--', ...paths], signal),
    ])
    return `${staged}${staged !== '' && unstaged !== '' ? '\n' : ''}${unstaged}`
  }
}

/** Read the current Git work-tree diff, including untracked files. */
export async function readWorkspaceChanges(cwd: string, signal: AbortSignal): Promise<WorkspaceChanges> {
  const repository = await gitOutput(cwd, ['rev-parse', '--is-inside-work-tree'], signal)
    .then(output => output.trim() === 'true')
    .catch((error: unknown) => {
      if (signal.aborted) throw error
      return false
    })
  if (!repository) return { repository: false, files: [], truncated: false }

  const entries = parseGitStatus(await gitOutput(cwd, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all',
  ], signal))
  const files: WorkspaceChange[] = []
  let retainedBytes = 0
  let truncated = false
  for (const entry of entries) {
    signal.throwIfAborted()
    let patch = entry.code === '??'
      ? await untrackedPatch(cwd, entry.path, signal)
      : await trackedPatch(cwd, entry, signal)
    const available = CHANGES_RESPONSE_LIMIT - retainedBytes
    const bytes = Buffer.from(patch)
    if (bytes.byteLength > available) {
      patch = available > 0 ? bytes.subarray(0, available).toString('utf8') : ''
      truncated = true
    }
    retainedBytes += Buffer.byteLength(patch)
    files.push({
      path: entry.path,
      ...(entry.previousPath === undefined ? {} : { previousPath: entry.previousPath }),
      status: changeStatus(entry.code),
      patch,
    })
    if (retainedBytes >= CHANGES_RESPONSE_LIMIT) {
      truncated = truncated || files.length < entries.length
      break
    }
  }
  return { repository: true, files, truncated }
}

export const inject = ['connection', 'workspaceRegistry']

export function apply(ctx: Context): void {
  const workspaceRegistry = ctx.get('workspaceRegistry') as { list(): readonly { path: string }[] }
  ctx.effect(() => ctx.connection.rpc.handle(WORKSPACE_FILE_CHANNEL, async (endpoint, payload, signal) => {
    if ((endpoint !== 'search' && endpoint !== 'changes') || typeof payload !== 'object' || payload === null) {
      return { ok: false, error: { code: 'internal', message: 'Invalid workspace request', details: {} } }
    }
    const { cwd, query } = payload as Record<string, unknown>
    if (typeof cwd !== 'string' || cwd === '' || (endpoint === 'search' && query !== '')) {
      return { ok: false, error: { code: 'internal', message: 'Invalid workspace request', details: {} } }
    }
    if (!workspaceRegistry.list().some(workspace => workspace.path === cwd)) {
      return { ok: false, error: { code: 'internal', message: 'Unknown workspace', details: {} } }
    }
    try {
      return {
        ok: true,
        value: endpoint === 'changes'
          ? await readWorkspaceChanges(cwd, signal)
          : await listWorkspaceFiles(cwd, signal),
      }
    } catch (error) {
      return {
        ok: false,
        error: { code: 'internal', message: error instanceof Error ? error.message : 'Workspace request failed', details: {} },
      }
    }
  }, { authority: 'trusted-host' }), 'ui-workspace: workspace RPC')
}
