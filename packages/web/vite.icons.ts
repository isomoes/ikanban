import { readFileSync } from "node:fs"
import type { Plugin } from "vite"
import manifest from "./manifest.json" with { type: "json" }

export function icons(channel: string): Plugin {
  let base = "/ikanban/"
  const selected = channel === "beta" || channel === "prod" ? channel : "dev"
  const prefix = `icons/${selected}`
  const files = [
    ...[
      "favicon.ico",
      "apple-touch-icon.png",
      "web-app-manifest-192x192.png",
      "web-app-manifest-512x512.png",
    ].map((name) => ({
      fileName: `${prefix}/${name}`,
      source: readFileSync(new URL(`./icons/${selected}/${name}`, import.meta.url)),
      type: name.endsWith(".ico") ? "image/x-icon" : "image/png",
    })),
    {
      fileName: "site.webmanifest",
      source: JSON.stringify({
        ...manifest,
        icons: manifest.icons.map((icon) => ({ ...icon, src: `./${prefix}/${icon.src}` })),
      }),
      type: "application/manifest+json",
    },
  ]

  return {
    name: "opencode-app:icons",
    configResolved(config) {
      base = config.base
    },
    generateBundle() {
      files.forEach((file) => this.emitFile({ type: "asset", fileName: file.fileName, source: file.source }))
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split("?")[0]
        const file = files.find((file) => `${base}${file.fileName}` === path || `/${file.fileName}` === path)
        if (!file) return next()
        response.setHeader("Content-Type", file.type)
        response.end(file.source)
      })
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html
          .replace("%OPENCODE_FAVICON%", `${base}${prefix}/favicon.ico`)
          .replace("%OPENCODE_APPLE_TOUCH_ICON%", `${base}${prefix}/apple-touch-icon.png`)
      },
    },
  }
}
