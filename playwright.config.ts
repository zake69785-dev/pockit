import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    browserName:
      process.env.POCKIT_BROWSER === "webkit" ? "webkit" : "chromium",
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions:
      process.platform === "win32" && process.env.POCKIT_BROWSER !== "webkit"
        ? { channel: "msedge" }
        : {},
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
