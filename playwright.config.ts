import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://127.0.0.1:4177" },
  webServer: {
    command: "corepack pnpm build && corepack pnpm start",
    url: "http://127.0.0.1:4177",
    env: {
      PORT: "4177",
      PI_WEB_FAKE_RUNTIME: "1",
      PI_WEB_STARTUP_TOKEN: "e2e-token",
    },
    reuseExistingServer: false,
  },
});
