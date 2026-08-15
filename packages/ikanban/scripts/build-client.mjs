import { cp } from 'node:fs/promises'

await Promise.all([
  cp(new URL('../../web-ui/lib/clients/', import.meta.url), new URL('../lib/clients/', import.meta.url), {
    recursive: true,
    force: true,
  }),
  cp(new URL('../../web-ui/dist/', import.meta.url), new URL('../lib/web/', import.meta.url), {
    recursive: true,
    force: true,
  }),
])
