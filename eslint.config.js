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
        // Transcendental functions may differ between browsers; online play needs bit-identical results.
        ...["sin", "cos", "tan", "asin", "acos", "atan", "atan2", "exp", "expm1", "log", "log2", "log10", "log1p", "pow", "cbrt", "hypot", "sinh", "cosh", "tanh"].map(
          (property) => ({
            object: "Math",
            property,
            message: "Not bit-identical across browsers. Use +, -, *, / and Math.sqrt (see docs/specs/01 §7).",
          }),
        ),
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "BinaryExpression[operator='**']", message: "Use multiplication; ** is not bit-identical across browsers." },
      ],
    },
  },
);
