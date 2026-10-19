import { defineConfig } from "vitest/config";

// GitHub Pages serves the site from /<repo>/, so builds use a relative base.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 8000,
    // Read by scripts/check-size.mjs to work out what loads at startup.
    manifest: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
