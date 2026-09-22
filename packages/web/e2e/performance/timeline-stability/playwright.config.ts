import config from "../playwright.config"

export default {
  ...config,
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "../../test-results/timeline-stability",
  reporter: [["html", { outputFolder: "../../playwright-report/timeline-stability", open: "never" }], ["line"]],
  retries: 0,
  workers: 1,
  webServer: config.webServer
    ? {
        ...config.webServer,
        env: {
          ...config.webServer.env,
          VITE_OPENCODE_URL: `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "3000"}`,
        },
      }
    : undefined,
  use: {
    ...config.use,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
}
