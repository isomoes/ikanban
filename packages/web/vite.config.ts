import { sentryVitePlugin } from "@sentry/vite-plugin"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import appPlugin, { channel } from "./vite.js"
import { icons } from "./vite.icons.ts"
import { serviceWorker } from "./vite.pwa.ts"

const sentry =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
        release: {
          name: process.env.SENTRY_RELEASE ?? process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          assets: "./dist/**",
          filesToDeleteAfterUpload: "./dist/**/*.map",
        },
      })
    : false

export default defineConfig({
  base: "/ikanban/",
  plugins: [
    appPlugin,
    icons(channel),
    {
      name: "ikanban:pages-fallback",
      enforce: "post",
      generateBundle(_options, bundle) {
        const index = bundle["index.html"]
        if (index?.type !== "asset") throw new Error("Missing Pages entry point")
        this.emitFile({ type: "asset", fileName: "404.html", source: index.source })
        this.emitFile({ type: "asset", fileName: ".nojekyll", source: "" })
      },
    },
    serviceWorker(fileURLToPath(new URL("./dist", import.meta.url))),
    sentry,
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    ...(process.env.VITE_OPENCODE_TEST_FIXTURES === "1"
      ? { rolldownOptions: { input: ["index.html", "e2e/utils/settings-wsl.html", "e2e/utils/app-direction.html"] } }
      : {}),
    assetsDir: "_assets",
    target: "esnext",
    sourcemap: true,
  },
})
