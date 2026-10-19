# Nutmeg specs

> **Nutmeg is a codename** (the repository is still called `fc94`). The public name is decided before release (see [03-legal-and-ip](03-legal-and-ip.md)).

These documents are the **single source of truth** for what we build. GitHub Issues track the work;
when an issue settles a question, the outcome is written back into the relevant spec.

## Index

| #   | Spec                                             | Status                                                             |
| --- | ------------------------------------------------ | ------------------------------------------------------------------ |
| 00  | [Vision](00-vision.md)                           | Draft — awaiting review                                            |
| 01  | [Platform & tech](01-platform-and-tech.md)       | Draft — awaiting review                                            |
| 02  | [Tooling & workflow](02-tooling-and-workflow.md) | Draft — awaiting review                                            |
| 03  | [Legal & IP](03-legal-and-ip.md)                 | Draft — awaiting review                                            |
| 10  | [Gameplay core](10-gameplay-core.md)             | Draft — awaiting review                                            |
| 11  | [AI](11-ai.md)                                   | Draft — awaiting review                                            |
| 12  | [Game modes & teams](12-modes.md)                | Draft — awaiting review                                            |
| 20  | Art direction & style guide                      | Not started — look decided: Stylised (see decision log)            |
| 21  | Audio (sfx, crowd, music)                        | Not started — scope decided: crowd + stadium sounds, no commentary |
| 22  | UI / UX (menus, HUD, onboarding, accessibility)  | Not started                                                        |
| 30  | [Milestones](30-milestones.md)                   | Draft — awaiting review                                            |

Status values: `Not started` → `Draft` → `Approved` → (`Revised` when a later decision changes it).

## Open decisions

| ID  | Question    | Options | Decide by             | Where                    |
| --- | ----------- | ------- | --------------------- | ------------------------ |
| D3  | Public name | TBD     | Before public release | [03](03-legal-and-ip.md) |

## Decision log

| Date       | Decision                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-18 | Web browser target; Babylon.js + TypeScript; free public release                                                                                                                                               |
| 2026-10-18 | Input: keyboard + gamepad (local MP 2–4); touch = 1P vs CPU in v1                                                                                                                                              |
| 2026-10-18 | Local multiplayer in v1, architecture ready for online in v2                                                                                                                                                   |
| 2026-10-18 | Cartoon low-poly art with high-end lighting, materials and weather                                                                                                                                             |
| 2026-10-18 | Weather/time of day: mostly visual, light gameplay effects                                                                                                                                                     |
| 2026-10-18 | CC0 + Mixamo assets, adapted to one style guide                                                                                                                                                                |
| 2026-10-18 | GitHub Pages hosting; GitHub Issues + Projects board for tracking                                                                                                                                              |
| 2026-10-18 | In-browser tuning panel so the product owner tunes game feel                                                                                                                                                   |
| 2026-10-18 | Repository is public; code licensed MIT; hosting on GitHub Pages (no per-PR preview links)                                                                                                                     |
| 2026-10-18 | Codename changed from "FC94" to **Nutmeg** (FC94 evoked EA Sports FC / FIFA 94)                                                                                                                                |
| 2026-10-18 | Only collaborators can open issues                                                                                                                                                                             |
| 2026-10-18 | **Art direction: Stylised** — low-poly cartoon shapes with physically based lighting, reflections, wet surfaces and bloom (look-test, #2). Toon/cel shading dropped                                            |
| 2026-10-18 | **Gameplay physics: custom arcade physics** in `src/sim/` (#4); Havok only for cosmetic effects, if ever                                                                                                       |
| 2026-10-18 | Camera: Classic '94 diagonal by default; Broadcast in settings                                                                                                                                                 |
| 2026-10-18 | Controls: 3 context buttons ('94 style) + sprint; remappable                                                                                                                                                   |
| 2026-10-18 | Default match length 2 × 5 min                                                                                                                                                                                 |
| 2026-10-18 | Rules: offside, fouls/free kicks/penalties, cards, extra time + shoot-out — all toggleable; fair visible referee                                                                                               |
| 2026-10-18 | 24 fictional nations with 1–5 star ratings; AI: 3 difficulty levels + optional assists                                                                                                                         |
| 2026-10-18 | v1 modes: Friendly + Practice/tutorial; World tournament in v1.1                                                                                                                                               |
| 2026-10-18 | Audio: crowd and stadium sounds, no commentary                                                                                                                                                                 |
| 2026-10-18 | Flair in v1: bicycle kicks, diving headers, curl/power shots, goal replays, celebrations                                                                                                                       |
| 2026-10-18 | v1.1 adds preset formations (v1 uses a fixed 4-4-2) and substitutes                                                                                                                                            |
| 2026-10-18 | Milestones: Vertical slice (5-a-side, small pitch, keyboard, 1P vs CPU) → Full match (11v11) → Alpha → Beta → v1.0 → v1.1                                                                                      |
| 2026-10-18 | Every merged PR deploys to Pages for playtesting; v1 launches on GitHub Pages                                                                                                                                  |
| 2026-10-19 | Every PR gets a playable preview link (gh-pages/pr-preview/pr-<n>/); the main link shows `main`                                                                                                                |
| 2026-10-19 | The goal frame collides with the ball as drawn (0.36 m); the ball moves in ≤ 8 cm hops so fast shots can't pass through posts, bar or net (#21)                                                                |
| 2026-10-19 | Review #19, all items accepted. Spec follows the built design: pass aims where you steer; first-time when pressed ≤ 0.3 s early; curl set at release (S1–S3)                                                   |
| 2026-10-19 | Gameplay constants live in `src/sim/params.ts`; the tuning panel is UI code (S4)                                                                                                                               |
| 2026-10-19 | Feel target: button to kick ≤ 50 ms (M6). CI tests WebGL2; WebGPU is checked by the product owner on real devices (N5)                                                                                         |
| 2026-10-19 | Added to the vertical slice: aftertouch + dribbling options, juice, readability, balance bots, set-piece aiming, pause, CI size and licence checks. Order in [30](30-milestones.md)                            |
| 2026-10-19 | Placed later: character test, perfect timing, corners aiming, floodlight pools (Full match); practice challenges, kit contrast check (Alpha); smaller download #6, graphics polish (Beta); share a goal (v1.1) |
| 2026-10-19 | Difficulty is the CPU team's only; the humans' teammates and keeper always play at Normal (#26)                                                                                                                |
| 2026-10-19 | Full match build order agreed ([30](30-milestones.md)); balance targets added: fouls 4–8, CPU passes 75–85%, no golden shot (#45)                                                                              |
