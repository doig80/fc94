# 02 — Tooling & workflow

**Status:** Draft — awaiting review

## Roles

- **Product owner (you):** vision, priorities, playtesting, approving specs and PRs.
- **Claude:** engineering, asset integration, tests, keeping specs and issues up to date. When a decision is
  needed, Claude asks it as a short interview (one question at a time, with options) rather than a numbered list.

## Repository layout

```
docs/specs/          specs (source of truth)
src/
  sim/               deterministic simulation (no Babylon); all gameplay constants in params.ts
  game/              match app: wires input, simulation and rendering together
  input/             keyboard, gamepad, touch -> intents
  render/            Babylon.js scenes, materials, effects, camera
  audio/  ui/        sound, menus, HUD, tuning panel
  looktest/          art-direction look-test (temporary)
  sandbox/           top-down physics debug view (?mode=physics)
public/assets/       runtime assets (GLB, KTX2, audio), made from the sources by scripts/assets/ (players: prepare_player.py, then player_lods.ts)
assets/LICENSES.md   licence register for every third-party asset
tests/               Vitest unit tests
e2e/                 Playwright smoke tests + screenshot scripts
.github/             CI, Pages deploy, issue templates, labels
.claude/             Claude Code hooks/settings
```

## Day-to-day flow

1. Work is captured as **GitHub Issues** (from specs, playtests, or ideas).
2. Claude picks an issue, works on a branch, opens a **pull request** that says `Fixes #n`.
3. CI runs on the PR: lint, typecheck, unit tests, build, download-size and licence checks, Playwright
   smoke tests + screenshots of the look-test and the match.
   The PR also gets its own **preview link** (posted as a comment, with a QR code for phones):
   `https://doig80.github.io/fc94/pr-preview/pr-<number>/`.
4. You play the preview and read the PR description, then merge (or ask for changes).
5. Merging to `main` deploys to **GitHub Pages** automatically (https://doig80.github.io/fc94/). You playtest from the link.
   The main link is the "released" version; previews are removed when their PR closes.
6. Feedback goes into new issues (template: _Playtest feedback_).

## GitHub Issues & Projects

- **Templates:** Bug, Playtest feedback, Idea (`.github/ISSUE_TEMPLATE/`).
- **Labels** (synced from `.github/labels.yml`):
  `bug`, `feedback`, `idea`, `spec`, `area:gameplay`, `area:graphics`, `area:audio`, `area:ui`,
  `area:infra`, `priority:high`, `priority:low`, `good-first-playtest`.
- **Milestones:** Look-test → Vertical slice → Full match → Alpha → Beta → v1.0 → v1.1 (see [30](30-milestones.md)).
- **Projects board** (kanban): _To do → In progress → In review → Done_. Issues are added to it as they're created.
- Rule: discussions may happen in issues, but **decisions are copied into the specs**.

## CI / CD (GitHub Actions)

| Workflow      | Trigger                        | Steps                                                                                                                                                         |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`      | PRs and pushes                 | install → lint → typecheck → unit tests → build → size + licence checks → Playwright smoke → screenshots of look-test and match (artifact linked from the PR) |
| `pages.yml`   | push to `main`                 | build → publish to the root of the `gh-pages` branch (GitHub Pages serves that branch)                                                                        |
| `preview.yml` | PR opened / updated / closed   | build → publish to `gh-pages/pr-preview/pr-<n>/` and comment the link; remove it when the PR closes                                                           |
| `labels.yml`  | change to `.github/labels.yml` | sync labels                                                                                                                                                   |

## Playtesting

- Every merge is playable at the Pages URL (desktop and phone).
- A debug overlay (`?debug=1`) shows fps, renderer (WebGPU/WebGL2), quality preset, draw calls.
- The Babylon.js Inspector is available in dev builds (`pnpm dev`, then `?inspector=1`). Production builds leave it
  out, so it never adds to the players' download.
- **Real-device check** (CI has no GPU, so it only tests WebGL2). At the end of each milestone, the product owner
  opens the main link with `?debug=1` on a laptop (Chrome or Edge), an iPhone or iPad (Safari) and, if available,
  an Android phone (Chrome), and for each:
  1. checks the overlay says **WebGPU** (or WebGL2 on browsers without WebGPU),
  2. plays one minute, noting stutter or visual glitches,
  3. reloads with `?renderer=webgl` and compares: both should look the same.

  Anything odd goes into a _Bug_ issue with a screenshot.

## Tuning panel

An in-browser panel (`?tune=1`) lists every gameplay constant (pass speed, shot power, ball friction,
AI reaction time, sprint boost, …) as sliders grouped by category. You can:

- adjust values live while playing,
- reset to defaults,
- **copy settings as JSON** and paste them into an issue — Claude commits them as the new defaults.

## Balance runs

`pnpm balance` plays hundreds of CPU-vs-CPU matches and exploit-bot drills without graphics (about 1½ minutes),
and checks them against targets ([10 §8](10-gameplay-core.md#8-feel-targets-for-playtesting),
[11](11-ai.md)). The simulation is deterministic, so the numbers only change when the code or a tuning value
changes. In CI the `balance` job:

- fails when an **enforced** target is missed (✅ / ❌ in the report),
- shows **known problems** waiting for a decision as ⚠️ without failing,
- posts the report on the PR, next to the base branch's numbers, so a tuning change shows its effect.

Targets live in `balance/*.balance.ts`. Changing one is a decision: it's written in the PR and in the spec.

## Claude Code tooling

| Tool                  | Purpose                                                                          | Set up in                                                 |
| --------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Context7 MCP**      | Up-to-date docs for Babylon.js 9, Vite, Playwright, etc. Avoids outdated APIs    | claude.ai Context7 connector (account level)              |
| **SessionStart hook** | Installs dependencies in each cloud session so Claude can build/test immediately | `.claude/settings.json`, `.claude/hooks/session-start.sh` |
| **Playwright**        | Claude launches the game headless, takes screenshots, and "sees" what it built   | `e2e/`, `pnpm screenshots`                                |
| **GitHub connector**  | Read/create issues, open PRs, react to CI and review comments                    | already connected                                         |
| `CLAUDE.md`           | Project rules for Claude (architecture constraints, where specs live)            | repo root                                                 |

Candidates for later: headless Blender (asset processing), an AI 3D/texture generation API.

## Definition of done (any change)

- Lint, typecheck, unit tests and build pass in CI.
- Visual changes: the PR links the CI screenshots (look-test and match) and says what to look at; Claude also
  shows the key screenshots in the session.
- Specs updated if behaviour or decisions changed.
- New third-party assets are recorded in `assets/LICENSES.md`.
