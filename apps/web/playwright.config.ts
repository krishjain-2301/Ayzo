import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests drive the real dashboard against the real API.
 * Start both first (API on 8000, dashboard on 3000), then: pnpm e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1, // the tests share one database
  reporter: [["list"]],
  use: {
    baseURL: process.env.AYZO_WEB_URL || "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
  },
});
