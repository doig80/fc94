# 30 — Milestones

**Status:** Draft — awaiting review

Every merged PR goes live on the Pages link straight away (https://doig80.github.io/fc94/), so there is
always something to play. Milestones group the work; each ends with a playtest by the product owner.

| #   | Milestone          | Goal                                 | Exit criterion                                                                                  |
| --- | ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 0   | **Look-test** ✅   | Choose the art direction             | Stylised chosen                                                                                 |
| 1   | **Vertical slice** | Prove the game is fun                | You enjoy a 5-a-side match vs CPU and ask for "one more"                                        |
| 2   | **Full match**     | Scale to real football               | A full 11v11 match plays well with all rules                                                    |
| 3   | **Alpha**          | Every v1 feature exists (rough)      | Everything in v1 scope is playable end to end                                                   |
| 4   | **Beta**           | Real art, audio, polish, performance | Meets the budgets in [01 §4](01-platform-and-tech.md#4-performance-budgets) on laptop and phone |
| 5   | **v1.0**           | Public release                       | Public name chosen, launch checklist done                                                       |
| 6   | **v1.1**           | Variety                              | World tournament, preset formations, substitutes                                                |

## 1. Vertical slice (5-a-side)

- **Pitch:** small pitch (~40 × 25 m) with small goals, in the stadium from the look-test (Stylised look).
- **Teams:** 5 v 5 (4 outfield players + goalkeeper), two placeholder teams.
- **Control:** 1 player vs CPU, **keyboard only**.
- **Gameplay:** full control scheme from [10 §3](10-gameplay-core.md#3-controls) (pass, shoot with power/curl,
  lob, switch, tackle, slide, sprint), custom arcade physics, header/bicycle-kick context actions.
- **Rules:** kick-off, goals, out of play (kick-ins, corners, goal kicks), fouls + free kicks + penalties,
  half-time and full time. No cards, no offside.
- **AI:** basic team shape, pressing, support runs, goalkeepers.
- **Presentation:** score and clock on screen, goal replay (simple). No menus: settings via the URL.
- **Tuning panel** (`?tune=1`) for all feel values, with copy/paste JSON (see [02](02-tooling-and-workflow.md#tuning-panel)).
- **Tests:** determinism test (same seed + inputs → same match), physics unit tests, smoke test.
- **Added after the review (#19):** ball-feel options (aftertouch switch, looser-dribbling slider, ≤ 50 ms
  input target), set-piece aiming for free kicks and penalties, pause, goalkeeper save types, auto-sprint,
  juice and readability, automatic CPU-vs-CPU balance tests, download-size and licence checks in CI.

**Build order** (one issue and one preview link each):

| Order | Issue                                           | Contains                                                    |
| ----- | ----------------------------------------------- | ----------------------------------------------------------- |
| 1–4   | #9–#12 ✅                                       | Simulation core, physics, 3D match view, keyboard controls  |
| 5     | [#22](https://github.com/doig80/fc94/issues/22) | Spec updates from the review                                |
| 6     | [#23](https://github.com/doig80/fc94/issues/23) | CI checks (size, licences, match screenshots) and dev tools |
| 7     | [#16](https://github.com/doig80/fc94/issues/16) | Tuning panel                                                |
| 8     | [#24](https://github.com/doig80/fc94/issues/24) | Ball feel: aftertouch, looser dribbling, input-lag target   |
| 9     | [#14](https://github.com/doig80/fc94/issues/14) | AI, keeper saves, auto-sprint                               |
| 10    | [#13](https://github.com/doig80/fc94/issues/13) | Match rules, free-kick and penalty aiming                   |
| 11    | [#15](https://github.com/doig80/fc94/issues/15) | Score, clock, goal replay, pause                            |
| 12    | [#25](https://github.com/doig80/fc94/issues/25) | Juice and readability, red kit fix                          |
| 13    | [#26](https://github.com/doig80/fc94/issues/26) | Balance bots: CPU-vs-CPU matches and exploit tests in CI    |

## 2. Full match (11 v 11)

Full-size pitch and goals, 11 v 11 with a 4-4-2 shape, offside, cards, advantage, extra time + shoot-out
option, full AI (shape, offside line, crosses), gamepad support, ref character.

Includes a **character test**: one real player model with retargeted animation
([#27](https://github.com/doig80/fc94/issues/27)), because animation is the top quality risk. Also: perfect-timing
reward and corner aiming ([#28](https://github.com/doig80/fc94/issues/28)), floodlight pools for night matches
([#29](https://github.com/doig80/fc94/issues/29)), and the fixes found by the balance runs (golden shot, too few
interceptions, too many fouls).

**Build order** (one issue and one preview link each):

| Order | Issue                                           | Contains                                                                   |
| ----- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| 1     | [#36](https://github.com/doig80/fc94/issues/36) | Draw calls within budget, before 11 v 11 adds 12 players                   |
| 2     | [#27](https://github.com/doig80/fc94/issues/27) | Character test in the look-test                                            |
| 3     | [#44](https://github.com/doig80/fc94/issues/44) | 11 v 11 on the full pitch, camera, pace check                              |
| 4     | [#45](https://github.com/doig80/fc94/issues/45) | Smarter CPU: shape, offside line, crosses; keeper variation, interceptions |
| 5     | [#46](https://github.com/doig80/fc94/issues/46) | Offside, cards, extra time and shoot-out, no-ref switch                    |
| 6     | [#47](https://github.com/doig80/fc94/issues/47) | Referee and assistants on the pitch                                        |
| 7     | [#48](https://github.com/doig80/fc94/issues/48) | Gamepad controls                                                           |
| 8     | [#28](https://github.com/doig80/fc94/issues/28) | Perfect-timing reward and corner aiming                                    |
| 9     | [#29](https://github.com/doig80/fc94/issues/29) | Floodlight pools for night matches                                         |

## 3. Alpha

Menus and match settings ([12](12-modes.md)), local multiplayer 2–4, touch controls (1P vs CPU),
practice challenges that double as the tutorial ([#30](https://github.com/doig80/fc94/issues/30)), all 24 nations
with placeholder kits and flags and an automatic kit contrast check ([#31](https://github.com/doig80/fc94/issues/31)),
weather and time of day affecting the match, quality presets, celebrations.

## 4. Beta

Final player models and animations, stadium art, kits and flags, crowd and stadium audio, UI polish,
accessibility pass, performance work (including the smaller download, [#6](https://github.com/doig80/fc94/issues/6)),
phone testing, graphics polish: TAA and wet-pitch reflections, grass, animated crowd, light beams on Ultra
([#32](https://github.com/doig80/fc94/issues/32)).

## 5. v1.0 launch checklist

Public name chosen and checked (D3) · credits and licences screen · privacy note · tested on the supported
browsers ([01 §1](01-platform-and-tech.md#1-platform)) · README and Pages link updated.

## 6. v1.1

World tournament ([12](12-modes.md)), **preset formations** to choose from (e.g. 4-4-2, 4-3-3, 3-5-2, 5-3-2),
**substitutes** (bench, manual and automatic subs, sent-off players not replaced), **share a goal** as a
replay link ([#33](https://github.com/doig80/fc94/issues/33)).
