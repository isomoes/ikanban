import { watch } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function watchFiles(files, rebuild, options = {}) {
  const debounceMs = options.debounceMs ?? 75
  const onError = options.onError ?? ((error) => console.error(error))
  const watchedFiles = new Set(files.map((file) => resolve(
    file instanceof URL ? fileURLToPath(file) : file,
  )))
  const directories = new Set([...watchedFiles].map(dirname))
  let timer
  let building = false
  let pending = false
  let closed = false

  const run = async () => {
    if (building || closed) return
    building = true
    try {
      while (pending && !closed) {
        pending = false
        try {
          await rebuild()
        } catch (error) {
          onError(error)
        }
      }
    } finally {
      building = false
    }
  }

  const schedule = () => {
    pending = true
    clearTimeout(timer)
    timer = setTimeout(run, debounceMs)
  }

  const watchers = [...directories].map((directory) => watch(directory, (_event, filename) => {
    if (filename === null || watchedFiles.has(resolve(directory, filename))) schedule()
  }))

  return {
    close() {
      closed = true
      clearTimeout(timer)
      for (const watcher of watchers) watcher.close()
    },
  }
}

async function rebuildClient() {
  const script = fileURLToPath(new URL('./build-client.mjs', import.meta.url))
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script], { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`client build exited with ${signal ?? code}`))
    })
  })
  console.log('iKanban client rebuilt')
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const sources = [
    new URL('../../ui-layout/src/client.js', import.meta.url),
    new URL('../../ui-sidebar/src/client.js', import.meta.url),
    new URL('../../ui-workspace/src/client.js', import.meta.url),
  ]
  const watcher = watchFiles(sources, rebuildClient)
  console.log('Watching iKanban UI sources...')
  const close = () => watcher.close()
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
}
