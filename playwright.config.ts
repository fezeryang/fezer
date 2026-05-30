import { defineConfig, devices } from "@playwright/test";

const localNoProxyHosts = [
  "127.0.0.1",
  "localhost",
  "::1",
  process.env.NO_PROXY,
  process.env.no_proxy,
]
  .filter(Boolean)
  .join(",");

process.env.NO_PROXY = localNoProxyHosts;
process.env.no_proxy = localNoProxyHosts;

const frontendBaseURL =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4301";
const apiBaseURL =
  process.env.PLAYWRIGHT_API_BASE_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:4300";
const frontendUrl = new URL(frontendBaseURL);
const apiUrl = new URL(apiBaseURL);
const frontendPort = frontendUrl.port || "80";
const apiPort = apiUrl.port || "80";
const allowedOrigins = Array.from(
  new Set([
    frontendBaseURL,
    apiBaseURL,
    `http://localhost:${frontendPort}`,
    `http://127.0.0.1:${frontendPort}`,
    `http://localhost:${apiPort}`,
    `http://127.0.0.1:${apiPort}`,
  ])
).join(",");

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL: frontendBaseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `pnpm exec vite --host ${frontendUrl.hostname} --port ${frontendPort}`,
      url: frontendBaseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_URL: apiBaseURL,
      },
    },
    {
      command: "pnpm exec tsx server/_core/index.ts",
      url: apiBaseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: apiPort,
        NODE_ENV: "development",
        VITE_API_URL: apiBaseURL,
        E2E_MOCK_AGENT_API: "true",
        JWT_SECRET:
          process.env.JWT_SECRET || "playwright-local-test-secret-32-chars",
        LOCAL_ADMIN_AUTH_BYPASS: "true",
        LOCAL_CONTENT_IN_MEMORY_FALLBACK: "true",
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || allowedOrigins,
      },
    },
  ],
});
