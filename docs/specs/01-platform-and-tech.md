# 01 — Platform & tech

**Status:** Draft — awaiting review

## 1. Platform

The game runs in a **web browser**, on desktop and mobile, with no install. It's hosted on GitHub Pages.
A later desktop wrapper (e.g. Tauri/Electron for Steam/itch.io download) remains possible because
the game is plain web tech, but it is not a v1 goal.

### Browser support

| Tier        | Browsers                                                              | Renderer                                     |
| ----------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Supported   | Latest 2 versions of Chrome, Edge, Safari (macOS/iOS/iPadOS), Firefox | WebGPU, falling back to WebGL2 automatically |
| Best effort | Samsung Internet, other Chromium browsers                             | WebGPU / WebGL2                              |
| Unsupported | Anything without WebGL2                                               | Friendly "browser not supported" page        |

Babylon.js picks WebGPU when available and falls back to WebGL2. **Every visual feature must
degrade gracefully** — no feature may exist only on WebGPU unless it is purely cosmetic.

## 2. Stack

| Concern         | Choice                                                   | Why                                                                                                                        |
| --------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Language        | TypeScript (strict)                                      | Type safety; Claude and tooling work best with it                                                                          |
| 3D engine       | Babylon.js 9.x (`@babylonjs/core`, ES modules)           | Most complete web 3D engine: WebGPU + WebGL2, PBR, node materials, particles, post-processing, glTF, GUI, audio, inspector |
| Build           | Vite                                                     | Fast dev server, simple static build for Pages                                                                             |
| Package manager | pnpm                                                     | Fast, strict lockfile                                                                                                      |
| Unit tests      | Vitest                                                   | Simulation logic is tested without a browser                                                                               |
| Browser tests   | Playwright (Chromium)                                    | Smoke tests, automated screenshots, scripted playtests                                                                     |
| Lint/format     | ESLint + Prettier                                        | Consistent code                                                                                                            |
| Assets          | glTF 2.0 / GLB, KTX2 textures, Draco/meshopt compression | Web-standard, small, fast to load                                                                                          |
| Audio           | Web Audio via Babylon audio engine                       | Positional crowd, ball, whistle                                                                                            |
| Physics         | Custom arcade physics (pure TypeScript) — see §6         | Arcade feel is fully tunable; identical results on every device keep online v2 possible                                    |

Versions are pinned in `package.json`/`pnpm-lock.yaml`. Upgrades are deliberate PRs. In Beta the game imports
only the Babylon.js parts it uses, to shrink the download ([#6](https://github.com/doig80/fc94/issues/6)).
Until then, the download-size check in CI keeps growth in view.

## 3. Architecture

The game is split into layers with one-way dependencies:

```
input  ──▶  simulation  ──▶  presentation (render, audio, UI)
 (devices)   (pure TS, fixed tick)   (Babylon.js)
```

- **Simulation** (`src/sim/`): ball, players, rules, AI, match state. Pure TypeScript, **no
  Babylon imports**, no `Math.random()` (seeded RNG only), no wall-clock time. Advances in a
  **fixed 60 Hz tick**. This makes it unit-testable, replayable, and ready for online v2
  (lockstep/rollback or server-authoritative).
- **Input** (`src/input/`): keyboard, Gamepad API, touch → a small per-player _intent_ struct
  (move vector + buttons) per tick. The simulation only ever sees intents.
- **Presentation** (`src/render/`, `src/audio/`, `src/ui/`): reads simulation state, interpolates
  between ticks for smooth visuals at any frame rate, plays animations, effects and sounds.
- **Tuning:** all gameplay constants live in one typed config object in `src/sim/params.ts`. The simulation
  owns its numbers, so they stay deterministic. The in-browser tuning panel (UI code, `src/ui/`) edits that
  object live (see [02](02-tooling-and-workflow.md#tuning-panel)).

Weather that affects play (rain → lower ball friction, snow → slightly slower ball) is
expressed as simulation parameters, so it stays deterministic.

## 4. Performance budgets

| Budget                          | Target                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Frame rate                      | 60 fps on a mid-range laptop (integrated GPU, ~2023); 30 fps floor on a ~3-year-old phone |
| Initial download (to main menu) | ≤ 15 MB compressed; ≤ 10 s on 25 Mbit/s                                                   |
| Full match assets               | ≤ 40 MB compressed, streamed/cached                                                       |
| Draw calls                      | ≤ 300 (High), ≤ 120 (Low) — instancing for crowd/players                                  |
| Player model                    | ≤ 3k triangles (LOD0), 2 LODs                                                             |
| Memory                          | ≤ 500 MB on mobile                                                                        |

Budgets are checked in CI where possible (download size, from [#23](https://github.com/doig80/fc94/issues/23))
and in Playwright perf runs.

## 5. Graphics quality presets

Auto-detected on first launch (GPU tier + a short benchmark), changeable in settings.

| Feature      | Low             | Medium                   | High                         | Ultra                             |
| ------------ | --------------- | ------------------------ | ---------------------------- | --------------------------------- |
| Render scale | 0.75            | 1.0                      | 1.0                          | 1.0 (native DPR)                  |
| Shadows      | Blob shadows    | 1 cascade, 1k            | 2 cascades, 2k, soft         | 3 cascades, 4k, contact shadows   |
| Lighting     | Baked + 1 sun   | + floodlight pools¹      | + floodlight shadows         | + screen-space GI / AO            |
| Post         | Tone mapping    | + FXAA, bloom            | + SSAO, TAA, colour grading  | + SSR (wet pitch), DOF in replays |
| Weather      | Light particles | Full particles           | + wet-pitch shader, splashes | + puddle reflections, light beams |
| Pitch        | Grass texture   | + hex tiling, wear, snow | + normal map                 | same as High                      |
| Crowd        | Billboards      | Low-poly instanced       | Animated instanced           | Animated + flags/flares           |

¹ Many lamps per tower via clustered lighting, on WebGPU and WebGL2 ([#29](https://github.com/doig80/fc94/issues/29)).
TAA, grass, animated crowd and light beams: [#32](https://github.com/doig80/fc94/issues/32).

## 6. Physics (decided: custom arcade physics)

Football needs very little physics: a ball (sphere with drag, spin/curve, bounce, friction),
players (capsules that push each other), goals and posts. Two options:

|                             | Havok (Babylon plugin)                                     | Custom arcade physics                                   |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Effort                      | Low to start                                               | Medium (ball + capsules + goal frame, ~1–2k lines)      |
| Feel control                | Must fight a realistic solver to get arcade feel           | Every behaviour is a tuning value                       |
| Same result on every device | **Not guaranteed** (WASM float behaviour, solver ordering) | Achievable with careful code                            |
| Online v2                   | Server-authoritative only; rollback impractical            | Lockstep / rollback / server-authoritative all possible |
| Testability                 | Needs WASM in tests                                        | Pure TS unit tests                                      |

**Decision (2026-10-18, #4):** custom arcade physics for gameplay, living in `src/sim/`. Havok may be used
later for purely cosmetic effects (net cloth, debris) that never feed back into the simulation.

## 7. Online v2 readiness (constraints for v1 code)

- Simulation is deterministic given seed + intent stream (enforced by a replay test in CI).
- No gameplay logic in rendering code.
- Match state is serialisable (snapshots for rollback / reconnection).
- The simulation uses only `+ - * /` and `Math.sqrt` (all exactly specified by IEEE 754). Functions such as
  `Math.sin`, `Math.atan2` or `Math.pow` can give slightly different results in different browsers, which would
  make two players' games drift apart online. ESLint blocks them in `src/sim/`.

## 8. Risks

| Risk                                             | Mitigation                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile GPUs struggle with lighting/weather       | Quality presets, auto-detect, Low preset tested on real phones                                                                                                                                 |
| iOS Safari quirks (audio unlock, memory limits)  | Tap-to-start screen, memory budget, regular iPhone playtests                                                                                                                                   |
| Animation quality (few football moves in Mixamo) | Early character test in Full match ([#27](https://github.com/doig80/fc94/issues/27)); stylised characters hide imperfections; procedural blending (aimed kicks, leaning); animation spec in 20 |
| WebGPU/WebGL2 visual differences                 | CI screenshot tests run on WebGL2 (CI has no GPU); WebGPU is checked by the product owner on real devices from the checklist in [02](02-tooling-and-workflow.md#playtesting)                   |
