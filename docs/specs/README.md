# Nutmeg specs

> **Nutmeg is a codename** (the repository is still called `fc94`). The public name is decided before release (see [03-legal-and-ip](03-legal-and-ip.md)).

These documents are the **single source of truth** for what we build. GitHub Issues track the work;
when an issue settles a question, the outcome is written back into the relevant spec.

## Index

| #   | Spec                                                            | Status                             |
| --- | --------------------------------------------------------------- | ---------------------------------- |
| 00  | [Vision](00-vision.md)                                          | Draft — awaiting review            |
| 01  | [Platform & tech](01-platform-and-tech.md)                      | Draft — awaiting review            |
| 02  | [Tooling & workflow](02-tooling-and-workflow.md)                | Draft — awaiting review            |
| 03  | [Legal & IP](03-legal-and-ip.md)                                | Draft — awaiting review            |
| 10  | Gameplay core (controls, rules, camera, match flow)             | Not started — next interview round |
| 11  | AI (teammates, opponents, difficulty)                           | Not started                        |
| 12  | Game modes (friendly, tournament, local multiplayer, online v2) | Not started                        |
| 20  | Art direction & style guide                                     | Not started — depends on look-test |
| 21  | Audio (sfx, crowd, music, commentary)                           | Not started                        |
| 22  | UI / UX (menus, HUD, onboarding, accessibility)                 | Not started                        |
| 30  | Milestones                                                      | Not started                        |

Status values: `Not started` → `Draft` → `Approved` → (`Revised` when a later decision changes it).

## Open decisions

| ID  | Question         | Options                                        | Decide by                             | Where                                                       |
| --- | ---------------- | ---------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| D1  | Visual look      | Stylised physically based vs toon / cel-shaded | After look-test playtest              | 20                                                          |
| D2  | Gameplay physics | Havok vs custom arcade physics                 | Before gameplay code (vertical slice) | [01 §6](01-platform-and-tech.md#6-physics-open-decision-d2) |
| D3  | Public name      | TBD                                            | Before public release                 | [03](03-legal-and-ip.md)                                    |

## Decision log

| Date       | Decision                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------ |
| 2026-10-18 | Web browser target; Babylon.js + TypeScript; free public release                           |
| 2026-10-18 | Input: keyboard + gamepad (local MP 2–4); touch = 1P vs CPU in v1                          |
| 2026-10-18 | Local multiplayer in v1, architecture ready for online in v2                               |
| 2026-10-18 | Cartoon low-poly art with high-end lighting, materials and weather                         |
| 2026-10-18 | Weather/time of day: mostly visual, light gameplay effects                                 |
| 2026-10-18 | CC0 + Mixamo assets, adapted to one style guide                                            |
| 2026-10-18 | GitHub Pages hosting; GitHub Issues + Projects board for tracking                          |
| 2026-10-18 | In-browser tuning panel so the product owner tunes game feel                               |
| 2026-10-19 | Repository is public; code licensed MIT; hosting on GitHub Pages (no per-PR preview links) |
| 2026-10-19 | Codename changed from "FC94" to **Nutmeg** (FC94 evoked EA Sports FC / FIFA 94)            |
| 2026-10-19 | Only collaborators can open issues                                                         |
