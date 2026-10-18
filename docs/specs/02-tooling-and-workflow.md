# 02 — Tooling & workflow

**Status:** Draft — awaiting review

## Roles

- **Product owner (you):** vision, priorities, playtesting, approving specs and PRs.
- **Claude:** engineering, asset integration, tests, keeping specs and issues up to date.

## Repository layout

```
docs/specs/          specs (source of truth)
src/
  sim/               deterministic simulation (no Babylon)
  input/             keyboard, gamepad, touch -> intents
  render/            Babylon.js scenes, materials, effects
  audio/  ui/        sound, menus, HUD
  tuning/            gameplay constants + tuning panel
  looktest/          art-direction look-test (temporary)
public/assets/       runtime assets (GLB, KTX2, audio)
assets/LICENSES.md   licence register for every third-party asset
tests/               Vitest unit tests
e2e/                 Playwright smoke tests + screenshot scripts
.github/             CI, Pages deploy, issue templates, labels
.claude/             Claude Code hooks/settings
```

## Day-to-day flow

1. Work is captured as **GitHub Issues** (from specs, playtests, or ideas).
2. Claude picks an issue, works on a branch, opens a **pull request** that says `Fixes #n`.
3. CI runs on the PR: lint, typecheck, unit tests, build, Playwright smoke test + screenshots.
4. You review the PR description and screenshots, then merge (or ask for changes).
5. Merging to `main` deploys to **GitHub Pages** automatically (https://doig80.github.io/fc94/). You playtest from the link.
   There are no per-PR preview links; PRs show screenshots instead.
6. Feedback goes into new issues (template: _Playtest feedback_).

## GitHub Issues & Projects

- **Templates:** Bug, Playtest feedback, Idea (`.github/ISSUE_TEMPLATE/`).
- **Labels** (synced from `.github/labels.yml`):
  `bug`, `feedback`, `idea`, `spec`, `area:gameplay`, `area:graphics`, `area:audio`, `area:ui`,
  `area:infra`, `priority:high`, `priority:low`, `good-first-playtest`.
- **Milestones:** Look-test → Vertical slice → Alpha → Beta → v1.0.
- **Projects board** (kanban): _To do → In progress → In review → Done_. Issues are added to it as they're created.
- Rule: discussions may happen in issues, but **decisions are copied into the specs**.

## CI / CD (GitHub Actions)

| Workflow     | Trigger                        | Steps                                                                                                    |
| ------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `ci.yml`     | PRs and pushes                 | install → lint → typecheck → unit tests → build → Playwright smoke + screenshots (uploaded as artifacts) |
| `pages.yml`  | push to `main`                 | build → deploy to GitHub Pages                                                                           |
| `labels.yml` | change to `.github/labels.yml` | sync labels                                                                                              |

## Playtesting

- Every merge is playable at the Pages URL (desktop and phone).
- A debug overlay (`?debug=1`) shows fps, renderer (WebGPU/WebGL2), quality preset, draw calls.
- The Babylon.js Inspector is available in dev builds (`?inspector=1`).

## Tuning panel

An in-browser panel (`?tune=1`) lists every gameplay constant (pass speed, shot power, ball friction,
AI reaction time, sprint boost, …) as sliders grouped by category. You can:

- adjust values live while playing,
- reset to defaults,
- **copy settings as JSON** and paste them into an issue — Claude commits them as the new defaults.

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
- Visual changes include screenshots in the PR.
- Specs updated if behaviour or decisions changed.
- New third-party assets are recorded in `assets/LICENSES.md`.
