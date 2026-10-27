import { defineConfig, devices } from "@playwright/test";
import { E2E_APP_URL, E2E_PORT, e2eServerEnv } from "./e2e/env";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: E2E_APP_URL,
    locale: "de-CH",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Fresh e2e database, production build, then serve it.
    command: `npx tsx e2e/prepare-db.ts && npm run build && npx next start -p ${E2E_PORT}`,
    url: `${E2E_APP_URL}/login`,
    env: e2eServerEnv(),
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
