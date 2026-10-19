# Spec alignment review (2026-10-18)

**Scope:** every spec (00–03, 10–12, 30) checked line by line against the code in PRs #7, #17 and #18
(simulation, physics, 3D match view, keyboard controls) and against the tooling (CI, Pages, issues).

**How to read this:** each finding has an ID, so you can say "do S1, S2; G2 into #15; skip N5".
Tick your choices in [#19](https://github.com/doig80/fc94/issues/19); decisions then go back into the specs.

## Summary

| Group                                                      | Count | Needs you?           |
| ---------------------------------------------------------- | ----- | -------------------- |
| **Fixed during the review** (already pushed to #18)        | 4     | No: review in #18    |
| **Spec should change to match a better design**            | 6     | Yes: OK the wording  |
| **Planned gaps** (known, already in an issue or milestone) | 8     | No: for awareness    |
| **Unplanned gaps** (not in any issue yet)                  | 9     | Yes: include or skip |

## 1. Fixed during the review (pushed to PR #18)

| ID  | Spec says                                                         | Was                                                         | Now                                                                                          |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| F1  | 10 §8: a pass arrives in ≤ 1 s (short) / ≤ 2 s (long)             | 10 m took 1.35 s, 20 m took 2.1 s                           | Passes arrive faster (8 m/s): 10 m in 0.97 s, 20 m in 1.6 s. A unit test locks the target in |
| F2  | 10 §3: holding Shoot "fills a power bar"                          | No bar was drawn                                            | Power bar (turns red when overpowered) plus a stamina bar                                    |
| F3  | 10 §5 / §7: slides, headers and bicycle kicks are visible moments | Players glided upright through every action                 | Placeholder poses for slide, stumble, header dive, bicycle kick, tackle and kick swing       |
| F4  | 10 (out of scope): keepers are always AI                          | A back pass to your keeper handed you control of the keeper | Control never switches to a keeper (test added)                                              |

## 2. The spec should change to match a better design (your OK needed)

| ID  | Spec      | Spec says                                                               | Built                                                                                                         | Why it's better / proposal                                                                     |
| --- | --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| S1  | 10 §3     | Pass "aims at the teammate you're facing"                               | Aims where the **stick** points; your facing only if no direction is held                                     | You can pass sideways without turning first. Update the wording                                |
| S2  | 10 §3     | "Pass while sprinting near the box → first-time ball"                   | Pass or shoot pressed **up to 0.3 s before the ball reaches you** is played first time, anywhere on the pitch | More general and easier to learn. Update the wording                                           |
| S3  | 10 §3     | Curl by steering "during the shot"                                      | Curl by steering **at the moment you release** shoot                                                          | Same idea, now precise. See research proposal M1 (aftertouch) for an extension                 |
| S4  | 01 §3, 02 | Gameplay constants in `src/tuning/`                                     | Constants in `src/sim/params.ts`; the panel will be UI code                                                   | The simulation must own its numbers (determinism). Update spec 01 §3 and the layout in spec 02 |
| S5  | 02        | Milestones: Look-test → Vertical slice → Alpha → Beta → v1.0            | Spec 30 and GitHub also have **Full match** and **v1.1**                                                      | Update spec 02                                                                                 |
| S6  | 02        | Debug overlay (`?debug=1`) shows fps, renderer, **quality, draw calls** | Shows fps, renderer, simulation tick                                                                          | Add quality and draw calls (tiny), or drop them from the spec                                  |

## 3. Planned gaps (no action needed, for awareness)

| ID  | Gap                                                                                                                    | Where it's planned          |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| G1  | No match rules yet (restarts, fouls, halves). A goal or out-of-play ball does a placeholder reset                      | #13                         |
| G2  | All other players stand still, keepers included                                                                        | #14 (AI)                    |
| G3  | No score, clock or goal replay                                                                                         | #15                         |
| G4  | No tuning panel                                                                                                        | #16                         |
| G5  | The opponent's forward stands inside the centre circle at kick-off                                                     | #13 (kick-off positions)    |
| G6  | Quality: spec has 4 presets with auto-detect and a short benchmark; built has Low/High, picked by "has a touch screen" | Alpha                       |
| G7  | The Low preset differs from the spec table (real shadow maps instead of blob shadows, FXAA on Low)                     | Alpha/Beta performance work |
| G8  | Key remapping and saved settings (10 §3)                                                                               | Alpha (menus)               |

## 4. Unplanned gaps (include or skip?)

| ID  | Spec      | Gap                                                                                                                     | Proposal                                                                                                          | Size |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| N1  | 10 §3     | **Pause** (`Esc`) exists nowhere yet                                                                                    | Add to #15 (HUD)                                                                                                  | S    |
| N2  | 11 §3     | **Auto-sprint** assist is a setting that does nothing                                                                   | Build it with the AI (#14), or remove it from the spec                                                            | S    |
| N3  | 01 §2     | "Tree-shaken" Babylon: the whole engine loads (≈ 7 MB raw, 1.5 MB compressed)                                           | Already #6; consider moving it from Vertical slice to Beta                                                        | M    |
| N4  | 01 §4     | "Bundle size checked in CI": no such check exists                                                                       | CI step that fails above a size budget                                                                            | S    |
| N5  | 01 §8     | Screenshot tests "on both backends": CI has no GPU, so WebGL2 only                                                      | Update the spec: WebGPU is checked by you on real devices, from a short checklist                                 | S    |
| N6  | 03        | Dependency licences must be permissive: nothing checks it                                                               | CI step that lists licences and fails on unexpected ones                                                          | S    |
| N7  | 02        | Babylon Inspector (`?inspector=1`) not wired up                                                                         | Add for dev builds (helps me debug visuals)                                                                       | S    |
| N8  | 02 DoD    | "Visual changes include screenshots in the PR": I can't attach images to PR text, and CI only screenshots the look-test | CI screenshots the match too, and each PR links the screenshot artifact                                           | S    |
| N9  | 00, 12 §2 | Colour-blind-safe kits: nothing checks contrast. Also, the red home kit reads **pink** in daylight                      | A kit contrast check when the 24 nations are made (Alpha); a colour/tone-mapping tweak in the art round (spec 20) | S    |

Also noted for the v1.0 checklist (no action now): the ad boards show the codename "NUTMEG". Replace it with
the public name or a fictional brand before launch.
