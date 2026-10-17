import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite against a freshly seeded database (global-setup runs `db:seed --reset`).
 * The dev server is started with E2E_TEST_LOGIN=1 so tests can sign in as seed users.
 * Specs share one database, so they run one at a time.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 180_000, // generous: the dev server compiles pages on first visit
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: { E2E_TEST_LOGIN: "1" },
  },
});
