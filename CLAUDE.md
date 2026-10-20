# Nutmeg — notes for Claude

Arcade football for the web. "Nutmeg" is a codename (the repo is still called `fc94`); the public name is
decided before launch (docs/specs/03). Never use "FC94", "FIFA" or "EA" in the game.
The repo is public and the code is MIT-licensed: never commit secrets, and only commit assets whose licence allows it.
The product owner is not a programmer: explain decisions in plain language, show screenshots for visual changes.
When you need decisions from the product owner, ask them as a short interview (one question at a time, with options
to pick from, using the AskUserQuestion tool) rather than a numbered list.

## Source of truth

- Specs live in `docs/specs/` (index + open decisions in `docs/specs/README.md`). Read the relevant spec before building.
- Work is tracked in GitHub Issues; PRs say `Fixes #n`. Decisions made in issues are written back into the specs.
- Every PR gets a playable preview (`preview.yml` comments the link: `/fc94/pr-preview/pr-<n>/`); the product owner
  reviews by playing it. The main link serves `main` from the `gh-pages` branch.

## Stack

Babylon.js 9 (WebGPU, WebGL2 fallback) + TypeScript (strict), Vite, pnpm, Vitest, Playwright.
Use the Context7 MCP for current Babylon.js/Vite/Playwright APIs instead of relying on memory.

## Architecture rules (docs/specs/01 §3)

- `src/sim/` is deterministic and engine-free: no `@babylonjs/*` imports, no `Math.random()`, no `Date.now()`
  (enforced by ESLint). Use `Rng` from `src/sim/rng.ts`. Only `+ - * /` and `Math.sqrt` — no `Math.sin/atan2/pow/...`
  or `**` (not bit-identical across browsers; also ESLint-enforced).
- `stepMatch(state, humanIntents, params)` (`src/sim/match.ts`) is one 60 Hz match tick: control switching,
  button actions (`actions.ts`), then physics (`step.ts`). All gameplay constants live in `src/sim/params.ts`
  (the tuning panel edits them).
- Input produces per-player intents; rendering only reads simulation state.
- Every visual feature must work on WebGL2 and on the Low quality preset.

## Commands

- `pnpm dev` — dev server · `pnpm build` — typecheck + production build
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest)
- `pnpm balance` — CPU-vs-CPU balance matches and exploit bots (~1½ min); `pnpm balance:report` prints the table
- `pnpm check:size` (after a build: startup download vs budget) · `pnpm check:licences` (dependency licences)
- `pnpm e2e e2e/smoke.spec.ts` — boots the game in headless Chromium
- Pages: `/` the match, 11 v 11 (`src/game/matchApp.ts`; `?size=5` plays 5-a-side), `?mode=looktest` the look-test, `?mode=physics` the physics sandbox
- Match rules from the URL: `?offside=0` · `?cards=0` · `?winner=1` (extra time + shoot-out) · `?ref=0` (no fouls/offside/cards)
- `?mode=physics` — top-down physics sandbox (debug view of `src/sim`); `pnpm e2e e2e/sandbox.spec.ts` tests it
- `pnpm screenshots` — renders look-test screenshots into `screenshots/` (slow: software rendering)
- `pnpm screenshots:match` — match screenshots (day views + night rain); CI links both sets from each PR
- `?debug=1` overlay: renderer, quality, fps, draw calls · `?inspector=1` opens the Babylon Inspector (`pnpm dev` only)
- Close-up for review: `SHOT_QUERY="look=toon&time=night&view=-2.6,1.2,14,48,0" SHOT_NAME=x pnpm e2e e2e/closeup.spec.ts`
- In cloud sessions set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` (the SessionStart hook does this).

## Assets

Every third-party asset goes in `assets/LICENSES.md`. Only CC0 / CC-BY / Mixamo / permitted AI-generated assets.
