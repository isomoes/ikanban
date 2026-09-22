import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_PAGES_PORT ?? 4178)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PLAYWRIGHT_PAGES_PORT")
const baseURL = `http://127.0.0.1:${port}/ikanban/`

// Deliberately serves an existing production build, with real HTTP 404s for deep links.
export default defineConfig({
  testDir: "./test-pages",
  outputDir: "./test-pages/test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  webServer: {
    command: "bun run script/serve-pages.ts",
    env: { PLAYWRIGHT_PAGES_PORT: String(port) },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 15_000,
  },
  use: {
    baseURL,
    locale: "en-US",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [{ name: "pages-chromium", use: { ...devices["Desktop Chrome"] } }],
})
