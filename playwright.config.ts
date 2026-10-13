import { defineConfig, devices } from "@playwright/test";

/**
 * Happy path against a seeded database. Before running:
 *   npm run db:seed -- --reset
 * The dev server is started with E2E_TEST_LOGIN=1 so tests can sign in as seed users.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: { E2E_TEST_LOGIN: "1" },
  },
});
