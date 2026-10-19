# 12 — Game modes & teams

**Status:** Draft — awaiting review

## 1. Modes

| Mode                            | Release | Players                                                         | Notes                                                                                                               |
| ------------------------------- | ------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Friendly**                    | v1      | 1P vs CPU; 2–4 local (same or opposite teams); touch: 1P vs CPU | Pick teams, difficulty, length, weather, time of day, rules                                                         |
| **Practice / tutorial**         | v1      | 1                                                               | **Practice challenges** that double as the tutorial ([#30](https://github.com/doig80/fc94/issues/30)), see below    |
| **World tournament**            | v1.1    | 1–4 (human teams)                                               | 24 nations: 6 groups of 4 → round of 16 → final; extra time + shoot-outs in knockouts; save progress in the browser |
| Preset formations + substitutes | v1.1    | —                                                               | Choose from e.g. 4-4-2, 4-3-3, 3-5-2, 5-3-2; bench with manual/auto subs                                            |
| Penalty shoot-out party mode    | Later   | 1–4                                                             | Candidate for after v1.1                                                                                            |
| Online play                     | v2      | 2+                                                              | Architecture ready (see [01 §7](01-platform-and-tech.md#7-online-v2-readiness-constraints-for-v1-code))             |

**Practice challenges:** short skill games on an empty pitch with a goalkeeper, each teaching one control
(curl into the top corner, a one-two then score, beat the keeper one-on-one, a free kick over the wall), with
a star rating to replay for. The first few are suggested to new players as the tutorial.

**Share a goal** (v1.1, [#33](https://github.com/doig80/fc94/issues/33)): a link that replays your goal on
any device. Because the simulation is deterministic, the replay is just the starting position plus the
inputs, so it fits in a URL.

**Local multiplayer:** each player picks a side on the controller-assignment screen (left team / CPU /
right team). Multiple humans on one team each control a different player.

## 2. Teams

- **24 fictional nations** with invented names, flags and home/away kits (no real-world flags or crests,
  see [03](03-legal-and-ip.md)).
- Each nation has a **1–5 star rating** that scales its players' speed, shooting, passing and the
  AI decision quality. There are no individual player stats in v1.
- Player names are generated per nation (fictional, checked so they don't match real players).
- Kits are checked for **colour-blind-safe contrast** against the opponent; the game picks the away kit
  automatically on a clash. An automated test checks every possible match-up
  ([#31](https://github.com/doig80/fc94/issues/31)).

## 3. Match settings (Friendly)

Team A / Team B · Difficulty (Easy / Normal / Hard) · Length (2 × 2/3/5/10 min) · Weather (clear / rain /
snow / random) · Time of day (day / dusk / night) · Rules toggles (offside, fouls, cards, must-have-a-winner)
· Referee (on / off) · Assists.

## 4. Front-end flow (v1)

Title → Main menu (Friendly · Practice · Settings · Credits) → Team select → Controller assignment →
Match settings → Loading (≤ 3 s target) → Match → Result screen (score, scorers, stats) → Rematch / Menu.

Detailed UI comes in spec 22.
