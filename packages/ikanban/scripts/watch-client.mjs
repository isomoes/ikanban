import { watch } from 'node:fs'
import { cp, mkdir, rename } from 'node:fs/promises'
import { basename, dirname, resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const webRoot = fileURLToPath(new URL('../../web-ui/', import.meta.url))
const webRequire = createRequire(new URL('../../web-ui/package.json', import.meta.url))

const editableSource = /\.(?:[cm]?[jt]sx?|css|html)$/
const generatedSegment = new RegExp(`(?:^|\\${sep})(?:lib|dist)(?:\\${sep}|$)`)

export function markDevelopmentBuild(environment) {
  environment.IKANBAN_DEV = '1'
}

export function createCoalescedRunner(run) {
  let running
  let pending = false

  return function requestRun() {
    pending = true
    if (running === undefined) {
      running = (async () => {
        let failure
        do {
          pending = false
          try {
            await run()
          } catch (error) {
            failure ??= error
          }
        } while (pending)
        if (failure !== undefined) throw failure
      })().finally(() => { running = undefined })
    }
    return running
  }
}

export function watchFiles(paths, rebuild, options = {}) {
  const debounceMs = options.debounceMs ?? 75
  const onError = options.onError ?? ((error) => console.error(error))
  const roots = paths.map(path => resolve(path instanceof URL ? fileURLToPath(path) : path))
  const pendingFiles = new Set()
  let timer
  let building = false
  let closed = false

  const run = async () => {
    if (building || closed || pendingFiles.size === 0) return
    building = true
    try {
      while (pendingFiles.size > 0 && !closed) {
        const files = [...pendingFiles]
        pendingFiles.clear()
        try {
          await rebuild(files)
        } catch (error) {
          onError(error)
        }
      }
    } finally {
      building = false
    }
  }

  const schedule = file => {
    if (generatedSegment.test(file) || !editableSource.test(file)) return
    pendingFiles.add(file)
    clearTimeout(timer)
    timer = setTimeout(run, debounceMs)
  }

  const watchers = roots.map(root => watch(root, { recursive: true }, (_event, filename) => {
    if (filename !== null) schedule(resolve(root, filename))
  }))

  return {
    close() {
      closed = true
      clearTimeout(timer)
      pendingFiles.clear()
      for (const watcher of watchers) watcher.close()
    },
  }
}

async function copyWithEntryLast(source, target, entry) {
  await mkdir(target, { recursive: true })
  await cp(source, target, {
    recursive: true,
    force: true,
    filter: path => path === source || basename(path) !== entry,
  })
  const temporary = resolve(target, `.${entry}.next`)
  await cp(resolve(source, entry), temporary, { force: true })
  await rename(temporary, resolve(target, entry))
}

async function closeWatcher(watcher) {
  if (typeof watcher.close === 'function') return watcher.close()
  if (typeof watcher[Symbol.asyncDispose] === 'function') return watcher[Symbol.asyncDispose]()
  throw new TypeError('Build watcher has no close operation')
}

export async function startWatchers(starters) {
  const results = await Promise.allSettled(starters.map(start => start()))
  const watchers = results
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value)
  const failure = results.find(result => result.status === 'rejected')
  if (failure !== undefined) {
    await Promise.allSettled(watchers.map(closeWatcher))
    throw failure.reason
  }
  return watchers
}

async function startClientWatcher() {
  const { build } = await import(pathToFileURL(webRequire.resolve('tsdown')).href)
  return build({
    cwd: webRoot,
    watch: true,
    hooks: {
      'build:done': async ({ options }) => {
        const source = resolve(webRoot, options.outDir)
        const id = basename(source)
        if (dirname(source) !== resolve(webRoot, 'lib/clients')) return
        await copyWithEntryLast(source, resolve(packageRoot, 'lib/clients', id), 'client.js')
        console.log(`iKanban client rebuilt: @isomoes/dsh-ikanban/client/${id}`)
      },
    },
  })
}

async function startFrontendWatcher() {
  const { build } = await import(pathToFileURL(webRequire.resolve('vite')).href)
  const watcher = await build({
    configFile: resolve(webRoot, 'vite.config.ts'),
    build: { watch: {} },
  })
  if (!('on' in watcher)) throw new Error('Vite did not return a build watcher')
  const copyFrontend = createCoalescedRunner(async () => {
    await copyWithEntryLast(resolve(webRoot, 'dist'), resolve(packageRoot, 'lib/web'), 'index.html')
    console.log('iKanban frontend rebuilt; reload the browser to use the new shell')
  })
  watcher.on('event', event => {
    if (event.code === 'ERROR') console.error(event.error)
    if (event.code !== 'END') return
    void copyFrontend().catch(error => console.error(error))
  })
  return watcher
}

async function main() {
  markDevelopmentBuild(process.env)
  const watchers = await startWatchers([startClientWatcher, startFrontendWatcher])
  console.log('Watching iKanban TS, TSX, CSS, and frontend shell sources...')

  await new Promise(resolveSignal => {
    process.once('SIGINT', resolveSignal)
    process.once('SIGTERM', resolveSignal)
  })
  await Promise.allSettled(watchers.map(closeWatcher))
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
