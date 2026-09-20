import { defineConfig } from "vite"
import ui from "./vite.js"
import { copyFile } from "node:fs/promises"
import { resolve } from "node:path"

export default defineConfig({
  plugins: [ui, {
    name: "github-pages-spa",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html) => html.replace('src="/oc-theme-preload.js"', 'src="/ikanban/oc-theme-preload.js"'),
    },
    async closeBundle() {
      await copyFile(resolve(import.meta.dirname, "dist/index.html"), resolve(import.meta.dirname, "dist/404.html"))
    },
  }],
  base: "/ikanban/",
  build: { target: "esnext" },
})
