import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  // The HTML report always lands in playwright-report/ (CI uploads it when the
  // job fails). It is never auto-opened so a failing run cannot block the
  // terminal; view it with `pnpm exec playwright show-report`.
  reporter: isCI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // CI serves a production build: `next dev` compiles each route on first
    // hit, which is slow and makes the first test on every page flaky.
    // NEXT_PUBLIC_* values are inlined at build time, so the build inherits
    // them from the environment (the CI workflow sets the same contract IDs
    // as its build step). Locally the dev server is reused if already up.
    command: isCI ? "pnpm build && pnpm start" : "pnpm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: isCI ? 10 * 60 * 1000 : 2 * 60 * 1000,
  },
});
