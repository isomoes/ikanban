import { cp } from 'node:fs/promises'

// Product bundles serve the tested shared shell verbatim. Shared dynamic clients
// remain in @isomoes/dsh-web-ui and resolve through that production dependency.
await cp(new URL('../../web-ui/web/', import.meta.url), new URL('../lib/web/', import.meta.url), {
  recursive: true,
  force: true,
})
