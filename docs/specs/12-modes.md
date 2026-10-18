# 12 — Game modes & teams

**Status:** Draft — awaiting review

## 1. Modes

| Mode                         | Release | Players                                                         | Notes                                                                                                               |
| ---------------------------- | ------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Friendly**                 | v1      | 1P vs CPU; 2–4 local (same or opposite teams); touch: 1P vs CPU | Pick teams, difficulty, length, weather, time of day, rules                                                         |
| **Practice / tutorial**      | v1      | 1                                                               | Empty pitch with goalkeeper; step-by-step on-screen hints for every control                                         |
| **World tournament**         | v1.1    | 1–4 (human teams)                                               | 24 nations: 6 groups of 4 → round of 16 → final; extra time + shoot-outs in knockouts; save progress in the browser |
| Penalty shoot-out party mode | Later   | 1–4                                                             | Candidate for after v1.1                                                                                            |
| Online play                  | v2      | 2+                                                              | Architecture ready (see [01 §7](01-platform-and-tech.md#7-online-v2-readiness-constraints-for-v1-code))             |

**Local multiplayer:** each player picks a side on the controller-assignment screen (left team / CPU /
right team). Multiple humans on one team each control a different player.

## 2. Teams

- **24 fictional nations** with invented names, flags and home/away kits (no real-world flags or crests,
  see [03](03-legal-and-ip.md)).
- Each nation has a **1–5 star rating** that scales its players' speed, shooting, passing and the
  AI decision quality. There are no individual player stats in v1.
- Player names are generated per nation (fictional, checked so they don't match real players).
- Kits are checked for **colour-blind-safe contrast** against the opponent; the game picks the away kit
  automatically on a clash.

## 3. Match settings (Friendly)

Team A / Team B · Difficulty (Easy / Normal / Hard) · Length (2 × 2/3/5/10 min) · Weather (clear / rain /
snow / random) · Time of day (day / dusk / night) · Rules toggles (offside, fouls, cards, must-have-a-winner)
· Referee (on / off) · Assists.

## 4. Front-end flow (v1)

Title → Main menu (Friendly · Practice · Settings · Credits) → Team select → Controller assignment →
Match settings → Loading (≤ 3 s target) → Match → Result screen (score, scorers, stats) → Rematch / Menu.

Detailed UI comes in spec 22.
