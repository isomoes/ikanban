import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { productTitle } from './src/build-presentation.ts'

const src = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url))
const packageVersion = (createRequire(import.meta.url)('./package.json') as { version: string }).version
const STANDALONE_ERROR = 'packages/web-ui is not a standalone application: bare Vite cannot inject window.__DSH_BOOT__. '
  + 'Build it through the iKanban package scripts and serve it through DSH.'

function rejectStandaloneServe(): Plugin {
  return {
    name: 'dsh-reject-standalone-web-serve',
    config(_config, env) {
      if (env.command === 'serve') throw new Error(STANDALONE_ERROR)
    },
  }
}

function identifyDevelopmentBuild(development: boolean): Plugin {
  return {
    name: 'ikanban-development-title',
    transformIndexHtml(html) {
      if (!development) return html
      return html.replace('<title>iKanban</title>', `<title>${productTitle('iKanban', true)}</title>`)
    },
  }
}

const VENDOR_PACKAGES: ReadonlySet<string> = new Set([
  'katex',
  'shiki',
  'mdast-util-from-markdown',
  'mdast-util-gfm',
  'mdast-util-math',
  'micromark-core-commonmark',
  'micromark-extension-gfm',
  'micromark-extension-math',
  'micromark-factory-space',
  'micromark-util-character',
  'micromark-util-classify-character',
  'micromark-util-sanitize-uri',
  'micromark-util-symbol',
  'micromark-util-types',
])

const BOOT_GRAMMAR_FILES: readonly string[] = [
  'dist/typescript.mjs',
  'dist/shellscript.mjs',
  'dist/json.mjs',
]

const FONT_EXTENSIONS: readonly string[] = ['.woff2', '.woff', '.ttf']

function npmPackageOf(id: string): string | undefined {
  const parts = id.split('/node_modules/')
  if (parts.length === 1) return undefined
  const packagePath = parts.at(-1)
  if (packagePath === undefined) return undefined
  const [first, second] = packagePath.split('/')
  if (first === undefined || first.startsWith('.')) return undefined
  if (first.startsWith('@')) return second === undefined ? undefined : `${first}/${second}`
  return first
}

export default defineConfig(({ mode }) => {
  const development = process.env.IKANBAN_DEV === '1' || mode === 'development'
  return {
    root: src('./'),
    plugins: [rejectStandaloneServe(), identifyDevelopmentBuild(development), react()],
    build: {
      outDir: src('./dist'),
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          chunkFileNames(chunk): string {
            if (chunk.name === 'index' || chunk.name === 'vendor') return 'assets/[name]-[hash].js'
            const isLangChunk = chunk.moduleIds.some(id => id.includes('/node_modules/@shikijs/langs/'))
            return isLangChunk ? 'assets/langs/[name]-[hash].js' : 'assets/[name]-[hash].js'
          },
          assetFileNames(asset): string {
            const fileName = asset.names[0] ?? ''
            const isFont = FONT_EXTENSIONS.some(ext => fileName.endsWith(ext))
            return isFont ? 'assets/fonts/[name]-[hash][extname]' : 'assets/[name]-[hash][extname]'
          },
          manualChunks(id: string): string | undefined {
            const pkg = npmPackageOf(id)
            if (pkg === undefined) return undefined
            if (pkg === '@shikijs/langs') {
              return BOOT_GRAMMAR_FILES.some(file => id.endsWith(`/${file}`)) ? 'vendor' : undefined
            }
            return VENDOR_PACKAGES.has(pkg) ? 'vendor' : undefined
          }
        },
      },
    },
    resolve: {
      alias: [
        { find: /^node:module$/, replacement: src('./src/node-module-stub.ts') },
        { find: /^@isomoes\/dsh-ikanban\/client\/web$/, replacement: src('./src/client/web/boot.tsx') },
        { find: /^@isomoes\/dsh-ikanban\/client\/web-react$/, replacement: src('./src/client/web-react/index.ts') },
        { find: /^@isomoes\/dsh-ikanban\/client\/ui-slots$/, replacement: src('./src/client/ui-slots/index.ts') },
        { find: /^@isomoes\/dsh-ikanban\/client\/ui-primitives$/, replacement: src('./src/client/ui-primitives/index.ts') },
        { find: /^@isomoes\/dsh-ikanban\/client\/ui-attachment$/, replacement: src('./src/client/ui-attachment/index.ts') },
        { find: /^@isomoes\/dsh-ikanban\/client\/schema-form$/, replacement: src('./src/client/schema-form/index.ts') },
        { find: /^@deepseek-ai\/dsh-client-modules\/client$/, replacement: src('./src/client/modules/client/index.ts') },
      ],
    },
    define: {
      __IKANBAN_DEV__: JSON.stringify(development),
      __IKANBAN_VERSION__: JSON.stringify(packageVersion),
      'process.versions.node': '"0.0.0"',
      'process.execArgv': '[]',
      'process.env.CORDIS_SHARED': 'undefined',
    },
  }
})
