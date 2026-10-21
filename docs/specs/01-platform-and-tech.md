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
As built: 6 lamps per tower on High and 2 on Low (the game has only these two presets so far), each aimed at its
own part of the pitch so the beams overlap into pools. Hardware without clustered lighting (WebGL2 without
float render targets) gets one wide lamp per tower, as before. The toon look keeps its floodlights off: the cel
shader washes out under them, and the match uses the stylised look.
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

| Risk                                             | Mitigation                                                                                                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile GPUs struggle with lighting/weather       | Quality presets, auto-detect, Low preset tested on real phones                                                                                                                                                    |
| iOS Safari quirks (audio unlock, memory limits)  | Tap-to-start screen, memory budget, regular iPhone playtests                                                                                                                                                      |
| Animation quality (few football moves in Mixamo) | Early character test in Full match ([#27](https://github.com/doig80/fc94/issues/27)); stylised characters hide imperfections; procedural blending (aimed kicks, leaning); animation spec in 20. Test status below |
| WebGPU/WebGL2 visual differences                 | CI screenshot tests run on WebGL2 (CI has no GPU); WebGPU is checked by the product owner on real devices from the checklist in [02](02-tooling-and-workflow.md#playtesting)                                      |

### Players ([#27](https://github.com/doig80/fc94/issues/27))

Every player, the referee and his assistants are a real model with real animation, chosen after the character test
(2026-10-21). `?players=old` still shows the old placeholder players; the look-test compares them with
`?mode=looktest&players=both` (the panel has a **Players** switch).

- **Model:** Quaternius's _Universal Base Characters_ man (CC0), with a 65-bone skeleton and two short hairstyles from
  the same pack. The kit is painted onto his body texture when he loads: a map made from which bone moves each part
  of the body says where the shirt (short sleeves), shorts, socks and boots go, so any team's colours work.
- **Two levels of detail** (§4): close up he is about 2,800 triangles (the original is 15,400), made by
  `scripts/assets/player_lods.ts` with meshoptimizer, which keeps the texture seams and the skinning. Beyond 24 m from
  the camera (`FAR`, most players in the match camera) a far version is drawn: about 800 triangles, body and hair
  only, as the eyes and eyebrows are a pixel or two from there. Shadows use the same version. Only the body casts a
  shadow.
- **Running:** idle, walk, jog and sprint from Quaternius's _Universal Animation Library_ (CC0), made for the same
  skeleton, so no retargeting. The two gaits around the player's speed are blended, and the stride cycles as fast as
  he covers the ground, so the feet don't slide and the legs slow down in slow motion and hold still in a freeze.
- **Moves** (`MOVES`, CC0, the same skeleton): the slide tackle and getting up from it (_Universal Animation Library
  2_), the keeper's dive and getting up (a dive roll: the flight, then rolling over and standing), and a leap for
  headers (a jump, lifted off the ground in code, with a nod through the ball). Each is laid over the running with a
  short blend in and out.
- **Still code-made poses:** kicks, the standing tackle, the bicycle kick, a stumble and the officials' signals, until
  the football moves arrive: from Anderson Rohr's free soccer motion-capture pack (made for the UE5 Manny skeleton,
  whose bone names match ours; free for games, its raw files stay in a private repository, see
  [03](03-legal-and-ip.md)), and from Mixamo for any move it lacks.
- **How it's driven:** `src/render/characterRig.ts` puts the model behind the same controls as the placeholders, so the
  match and the officials drive either. The animations are sampled once when the model loads and blended per bone in
  our own code (`blendTrack`), not played by Babylon's animation system: held still and moved by hand, Babylon put
  them back on their first frame every frame (the legs didn't move), and it cost 5–6 ms a frame.
- **Assets:** `scripts/assets/prepare_player.py` builds `public/assets/characters/` from the three Quaternius packs
  (downloaded from quaternius.itch.io, not kept in the repo), then `node scripts/assets/player_lods.ts` makes the two
  levels of detail: the model and animations are 0.66 MB, the body texture and kit map 75 kB. They load after the
  match has started (the placeholders show until then), so the wait to play doesn't change.
- **What it costs** (measured in a live 11 v 11 match, software rendering in CI):

  |                                     | Old players  | New players |
  | ----------------------------------- | ------------ | ----------- |
  | Draw calls, High (budget 300)       | 96           | 175         |
  | Draw calls, Low (budget 120)        | 36           | 70          |
  | Triangles, High                     | 176,000      | 250,000     |
  | Triangles, Low                      | 75,000       | 89,000      |
  | Posing the players, per frame (CPU) | under 0.1 ms | about 1 ms  |
