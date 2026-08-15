import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { apply as applyUpstream, internals, type Config } from '@deepseek-ai/dsh-web-app'

export * from '@deepseek-ai/dsh-web-app'

/** Delegate the Web runtime with this package's frontend dist for this activation only. */
export function apply(ctx: Context, config: Config): void {
  const resolveDistIndex = internals.resolveDistIndex
  internals.resolveDistIndex = () => fileURLToPath(new URL('./web/index.html', import.meta.url))
  try {
    applyUpstream(ctx, config)
  } finally {
    internals.resolveDistIndex = resolveDistIndex
  }
}
