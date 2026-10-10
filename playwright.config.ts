import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  // Generous budgets: CI/dev machines running builds alongside the suite can
  // be slow (isolated tests take ~15-20s here). Assertions are unchanged.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3010",
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm start -- --hostname 127.0.0.1 --port 3010",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
