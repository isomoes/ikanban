import { readFile, writeFile } from 'node:fs/promises'

const stripSourceMapComment = source => source.replace(/\n\/\/# sourceMappingURL=.*\n?$/, '\n')

const [runtime, declarations] = await Promise.all([
  readFile(new URL('../../project-mcp/lib/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../../project-mcp/lib/types/index.d.ts', import.meta.url), 'utf8'),
])

await Promise.all([
  writeFile(new URL('../lib/project-mcp.js', import.meta.url), stripSourceMapComment(runtime)),
  writeFile(new URL('../lib/types/project-mcp.d.ts', import.meta.url), stripSourceMapComment(declarations)),
])
