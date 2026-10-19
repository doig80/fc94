import { defineConfig } from "@playwright/test";

// In Claude's cloud container Chromium is pre-installed at /opt/pw-browsers/chromium.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  // One browser at a time on CI: software rendering is CPU-bound, and parallel tests starve each other.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      // Software WebGL so tests run on machines without a GPU.
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
