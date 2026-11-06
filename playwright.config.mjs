import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4187",
    browserName: "chromium"
  },
  webServer: {
    command: "node scripts/dev-server.mjs",
    env: { PORT: "4187", NO_AUTO_OPEN: "1" },
    url: "http://127.0.0.1:4187/api/health",
    reuseExistingServer: false,
    timeout: 30000
  }
});
