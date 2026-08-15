import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
if (args[0] === '--') args.shift()

const children = [
  spawn(process.execPath, ['packages/ikanban/scripts/watch-client.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, IKANBAN_DEV: '1' },
  }),
  spawn('dsh', ['--profile', 'ikanban-dev', ...args], { stdio: 'inherit' }),
]

const exits = children.map((child) => new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', (code, signal) => resolve({ child, code, signal }))
}))

let stopping = false
const stop = (signal = 'SIGTERM') => {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal)
  }
}

process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))

try {
  const result = await Promise.race(exits)
  stop()
  await Promise.allSettled(exits)
  if (result.code !== 0 && result.signal === null) process.exitCode = result.code ?? 1
} catch (error) {
  stop()
  await Promise.allSettled(exits)
  throw error
}
