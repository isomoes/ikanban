import { copyFile, mkdir, writeFile } from 'node:fs/promises'

await mkdir(new URL('../lib/types/', import.meta.url), { recursive: true })
await Promise.all([
  copyFile(new URL('../src/client.js', import.meta.url), new URL('../lib/client.js', import.meta.url)),
  writeFile(new URL('../lib/index.js', import.meta.url), 'export function apply() {}\n'),
  writeFile(new URL('../lib/types/index.d.ts', import.meta.url), 'export declare function apply(): void\n'),
  writeFile(new URL('../lib/types/client.d.ts', import.meta.url), 'export declare const inject: string[]\nexport declare function apply(ctx: unknown): void\n'),
])
