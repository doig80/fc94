import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The simulation must stay deterministic and engine-free (docs/specs/01 §3).
    files: ["src/sim/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@babylonjs/*"] }],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG in src/sim/rng.ts." },
        { object: "Date", property: "now", message: "The simulation must not read wall-clock time." },
      ],
    },
  },
);
