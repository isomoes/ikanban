import { cp, readFile, writeFile } from 'node:fs/promises'

const sharedWeb = new URL('../../web-ui/web/', import.meta.url)
const productWeb = new URL('../lib/web/', import.meta.url)

// Product bundles serve the tested shared shell, then brand only their own copy.
// Shared dynamic clients remain in @isomoes/dsh-web-ui and resolve through that
// production dependency.
await cp(sharedWeb, productWeb, {
  recursive: true,
  force: true,
})

const indexUrl = new URL('index.html', productWeb)
const index = await readFile(indexUrl, 'utf8')
const branded = index.replace(/<title>[^<]*<\/title>/, '<title>iKanban</title>')
if (branded === index) throw new Error('shared Web shell does not contain a replaceable title')
await writeFile(indexUrl, branded)
