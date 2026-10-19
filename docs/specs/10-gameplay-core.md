# 10 — Gameplay core

**Status:** Draft — awaiting review

The rules of play: what happens on the pitch and how players control it. All numbers marked _(tune)_
are starting values in the tuning panel, not final balance.

## 1. The match

- **11-a-side** on a full-size pitch (105 × 68 m), as in the original.
- **Default length: 2 × 5 minutes** of game time (options: 2 × 2, 2 × 3, 2 × 5, 2 × 10). The game clock runs
  faster than real time, so a "90-minute" match is shown on the scoreboard.
- **Kick-off → half-time → second half → full time.** Teams swap ends at half-time.
- **Restarts** (throw-in, corner, goal kick, free kick, penalty) are quick: the right player auto-runs to
  the ball, and play resumes on one button press or after 3 seconds _(tune)_.

## 2. Camera

- **Default: Classic '94 diagonal** — a high angled view that follows the ball, looking towards the
  goal being attacked. It smoothly leads in the direction of play.
- **Broadcast** (side view) is available in settings.
- The camera never cuts during open play. Cinematic angles are used only in replays and celebrations.
- Local multiplayer shares one screen (no split screen); the camera frames the ball, not individual players.

## 3. Controls

Three action buttons + sprint, with meanings that depend on whether your team has the ball (like 1994).

| Button     | Gamepad    | Keyboard (P1) | Attacking                                          | Defending                             |
| ---------- | ---------- | ------------- | -------------------------------------------------- | ------------------------------------- |
| **A**      | A / ✕      | `J`           | Pass (ground) — aims at the teammate you're facing | Switch to the player nearest the ball |
| **B**      | B / ○      | `K`           | Shoot — hold to power up                           | Tackle (standing)                     |
| **C**      | X / □      | `L`           | Lob / cross / through ball                         | Slide tackle                          |
| **Sprint** | RT / R2    | `Space`       | Sprint (limited stamina)                           | Sprint                                |
| Move       | Left stick | `WASD`        | Run / dribble                                      | Run / jockey                          |
| Pause      | Start      | `Esc`         | Pause menu                                         | Pause menu                            |

- Keyboard player 2 uses the arrow keys + `1` `2` `3` + `0` (numpad), all remappable.
- **Context actions** happen automatically, so no extra buttons are needed:
  - Shoot when the ball is at chest/head height → **diving header** or **bicycle kick** (if facing away from goal).
  - Pass while sprinting near the box → first-time ball.
  - Double-tap pass → one-two (give and go).
- **Curl & power shots:** holding Shoot fills a power bar; steering left/right during the shot
  curls the ball. Overpowering sends it over the bar.
- **Touch (phone, 1P vs CPU):** virtual stick on the left; Pass / Shoot / Lob + Sprint buttons on the right.
- Every binding is **remappable**; settings remember the player's choice.

## 4. Player switching & assists

- The controlled player has a coloured ring (player 1 = yellow, 2 = cyan, 3 = magenta, 4 = lime).
- **Auto-switch** (assist, default on): control jumps to the player best placed to receive or defend.
- Other assists (see [11 AI](11-ai.md) for defaults per difficulty): aim help on shots, auto-sprint,
  pass-lead (passes aimed ahead of a running teammate).

## 5. Ball & player physics (custom arcade physics)

Decided in [01 §6](01-platform-and-tech.md#6-physics-decided-custom-arcade-physics): the simulation is pure
TypeScript in `src/sim/`, runs at a fixed 60 Hz, and is deterministic.

- **Ball:** a sphere with gravity, air drag, spin (Magnus curve), bounce and rolling friction.
  Drawn larger than life (0.36 m) so it's easy to follow; collisions use the real 0.22 m size, except against
  the goal frame, which uses the drawn size so a shot that looks like it clips the post does hit it.
- **Dribbling:** the ball stays "attached" just ahead of the controlling player's feet at low speed;
  sprinting pushes it further ahead (easier to steal).
- **Players:** capsules with acceleration, top speed, turning rate and sprint stamina _(tune)_.
  They push each other gently; no ragdoll falls except after fouls/slides.
- **Goal frame:** posts and crossbar bounce the ball; the net absorbs it. Fast balls are moved in short hops
  (≤ 8 cm) so even a full-power shot can't skip through a post, the bar or the net between two ticks.
- **Weather effects** (from [00](00-vision.md)): rain → less rolling friction (ball skids);
  snow → more friction and a slightly slower ball. Visual only for players.

## 6. Rules

All rules default **on** at Normal/Hard and can be toggled in match settings.

| Rule                           | Default                                       | Notes                                                                                   |
| ------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Offside                        | On (off on Easy)                              | Shown with a brief line on the pitch when called                                        |
| Fouls, free kicks, penalties   | On                                            | Fouls from mistimed tackles, sliding from behind, or tackling without touching the ball |
| Yellow & red cards             | On                                            | Two yellows = red. Sent-off players leave the pitch (no subs in v1)                     |
| Extra time + penalty shoot-out | Off in Friendly (option "Must have a winner") | Always on for knockout matches in the v1.1 tournament                                   |
| Advantage                      | On                                            | The ref waves play on when the fouled team keeps the ball                               |

**Referee:** a visible ref character on the pitch, **fair and consistent** (no random cards).
Can be switched to "no ref" for arcade chaos (no fouls or offside at all).

## 7. Signature moments

- **Bicycle kicks & diving headers** — context actions (see §3).
- **Curl & power shots** — see §3.
- **Goal replays** — an instant replay after every goal (skippable), from 2–3 cinematic cameras.
  Cheap because the simulation is deterministic: replay = re-run the recorded inputs.
- **Celebrations** — short (≤ 4 s, skippable): knee slide, team pile-on, a few more later.

## 8. Feel targets (for playtesting)

- A pass to a teammate in open space arrives in ≤ 1 s (short) / ≤ 2 s (long).
- A first-time player scores against Easy CPU within their first match.
- Average Normal-difficulty match: 3–6 goals in total.
- Goalkeepers save most long shots but are beatable with curl, power and angles.

## Out of scope for v1

Substitutions and preset formations (both planned for **v1.1**, see [30](30-milestones.md); v1 uses one
4-4-2 for every team), a free-form tactics editor, injuries, skill-move combos, manual goalkeeper control
(keepers are always AI).
