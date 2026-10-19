import { defineConfig } from "vitest/config";

// The balance runs (docs/specs/11 §6): `pnpm balance`. Slow, so they're kept out of `pnpm test`.
export default defineConfig({
  test: {
    root: ".",
    include: ["balance/**/*.balance.ts"],
    testTimeout: 10 * 60 * 1000,
  },
});
