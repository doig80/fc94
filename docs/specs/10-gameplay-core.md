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
- **Set pieces are aimed** with a target marker on the pitch (as in 1994): free kicks and penalties in the
  vertical slice ([#13](https://github.com/doig80/fc94/issues/13)), corners in Full match
  ([#28](https://github.com/doig80/fc94/issues/28)). At a corner the marker is a ring on the grass that starts
  on the penalty spot; the stick moves it anywhere in the box, Lob crosses to it (for the teammate nearest it),
  and the camera frames the box so you can see it. The CPU picks the near post, the penalty spot or the far post.

## 2. Camera

- **Default: Classic '94 diagonal** — a high angled view that follows the ball, looking towards the
  goal being attacked. It smoothly leads in the direction of play.
- **Broadcast** (side view) is available in settings.
- The camera never cuts during open play. Cinematic angles are used only in replays and celebrations.
- Local multiplayer shares one screen (no split screen); the camera frames the ball, not individual players.

## 3. Controls

Three action buttons + sprint, with meanings that depend on whether your team has the ball (like 1994).

| Button     | Gamepad    | Keyboard (P1) | Attacking                            | Defending                             |
| ---------- | ---------- | ------------- | ------------------------------------ | ------------------------------------- |
| **A**      | A / ✕      | `J`           | Pass (ground) — aims where you steer | Switch to the player nearest the ball |
| **B**      | B / ○      | `K`           | Shoot — hold to power up             | Tackle (standing)                     |
| **C**      | X / □      | `L`           | Lob / cross / through ball           | Slide tackle                          |
| **Sprint** | RT / R2    | `Space`       | Sprint (limited stamina)             | Sprint                                |
| Move       | Left stick | `WASD`        | Run / dribble                        | Run / jockey                          |
| Pause      | Start      | `Esc`         | Pause menu                           | Pause menu                            |

- Keyboard player 2 uses the arrow keys + `1` `2` `3` + `0` (numpad), all remappable.
- **Gamepad** ([#48](https://github.com/doig80/fc94/issues/48)): any standard pad (Xbox, PlayStation and most
  others) in Chrome, Edge, Firefox and Safari, plugged in or out at any time; the keyboard keeps working
  alongside it. The left stick is analogue (a small tilt is ignored, a half tilt jogs, and the direction is
  exact, for finer aiming and curl); the d-pad runs too. RB also sprints, for pads without analogue triggers.
  Start pauses, Back restarts, Y shows the controls, and A, B or X skip a replay. The controls help switches
  to pad buttons when a pad is connected. Several pads for local multiplayer come in Alpha.
- **Context actions** happen automatically, so no extra buttons are needed:
  - Shoot when the ball is at chest/head height → **diving header** or **bicycle kick** (if facing away from goal).
  - Pass or Shoot pressed up to 0.3 s _(tune)_ before the ball reaches you → played **first time**, anywhere on
    the pitch. For a cross or lob played to you, an early Shoot becomes the volley or header as it arrives.
  - Lob from out wide in the final third → **cross** to the teammate in the box nearest its middle, dropping just
    past them so it reaches them at volley height; with nobody there, just beyond the near post.
  - Defenders **head away** a cross or lob meant for an opponent when it comes within reach in their own area,
    automatically, like a keeper's hands ([#45](https://github.com/doig80/fc94/issues/45)). Shots are left alone.
  - Double-tap pass → one-two (give and go).
- **Passing direction:** a pass goes to the teammate in the direction you steer; with no direction held, to
  the teammate you're facing. So you can pass sideways without turning first.
- **Curl & power shots:** holding Shoot fills a power bar; the direction you steer at the moment you
  **release** Shoot curls the ball. Overpowering sends it over the bar.
- **Aftertouch** (on by default, switchable while being tested, [#24](https://github.com/doig80/fc94/issues/24)):
  for a split second after a **shot**, steering still bends the ball, pulling back lifts it and pushing further
  on dips it, as in Sensible Soccer. Passes have none, because by then the stick steers the receiver.
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
  sprinting pushes it further ahead (easier to steal). A looseness slider (from "at your feet" to "pushed
  ahead in touches", Kick Off style) is being tested in [#24](https://github.com/doig80/fc94/issues/24);
  sticky stays the default until the playtest decides.
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
Can be switched to "no ref" for arcade chaos (no fouls, offside or cards at all).

**The officials on the pitch** ([#47](https://github.com/doig80/fc94/issues/47)), so you can tell what was
decided without reading the banner. They're presentation only: the ball and the players pass straight by.

- The **referee**, in black, follows play on a diagonal about 11 m from the ball, towards the middle, facing it.
- He **signals** each call: the whistle to his mouth first, then pointing the way of a free kick or kick-in, to
  the spot for a penalty, corner or goal kick, to the centre after a goal; both arms forward for **advantage**;
  the **card** held up towards the player.
- Two **assistants** run opposite touchlines, one per half, level with the offside line, and raise the **flag**
  for offside.
- With no referee, none of them are there.

How each rule is called ([#46](https://github.com/doig80/fc94/issues/46)):

- **Offside** is judged the moment a teammate plays the ball: a player in the opponents' half who is beyond
  both the ball and the second-last opponent (the keeper counts) is offside if they're the next to touch it.
  Level is onside, with a 0.2 m margin _(tune)_ in the attacker's favour. Never from a kick-in, corner or goal
  kick. The defending team gets a free kick where the offside player was, and a yellow line on the grass shows
  for 3 seconds where the line was. The computer players don't pass to a teammate standing offside, and their
  runs stop at the line.
- **Cards** follow fixed rules, the same every time: a foul that stops a player who is through on goal (on the
  ball, within 30 m _(tune)_, no defender but the keeper goal side) is a **red**, or a yellow if it gives away a
  penalty; a **slide from behind** is a yellow; other fouls get no card. Two yellows make a red. A sent-off
  player leaves the pitch and the team plays on with one fewer. Cards show under the referee's call and on the
  scoreboard.
- **Must have a winner:** a draw after 90 minutes goes to **extra time**, two halves of 15 minutes (a third of a
  normal half _(tune)_), then a **penalty shoot-out** at one goal: five kicks each, then sudden death. Forwards
  take the first kicks, the keeper the last. You take your team's kicks with the aiming marker; keepers stay AI.
  A ball the taker plays again after a save doesn't count.
- Until the menus arrive (Alpha), these are URL options: `?offside=0`, `?cards=0`, `?winner=1`, `?ref=0`.

## 7. Signature moments

- **Bicycle kicks & diving headers** — context actions (see §3).
- **Curl & power shots** — see §3.
- **Goal replays** — an instant replay after every goal (skippable), from 2–3 cinematic cameras.
  Cheap because the simulation is deterministic: replay = re-run the recorded inputs.
- **Celebrations** — short (≤ 4 s, skippable): knee slide, team pile-on, a few more later.
- **Impact ("juice")** — a 50–100 ms freeze on power shots and goals, a small camera kick, net ripple,
  short slow motion on a winning goal, controller rumble where the browser supports it
  ([#25](https://github.com/doig80/fc94/issues/25)). Strengths are tuning-panel values.
- **Perfect timing** — first-time shots and volleys struck in a tight timing window get extra power or
  accuracy and a flash (Full match, [#28](https://github.com/doig80/fc94/issues/28)). Built as: Shoot pressed
  within 0.1 s _(tune)_ of striking the ball (first time, or a volley or header) is **Perfect**: 25% more power
  _(tune)_, a gold burst around the player, "Perfect!" on screen, and the short freeze of a power shot. Pressed
  earlier it still works (the 0.3 s buffer), just without the bonus.
- **Readability** — the ball has a blob shadow that shows its height, fast balls leave a short trail, and
  an off-screen marker shows where your player is ([#25](https://github.com/doig80/fc94/issues/25)).

## 8. Feel targets (for playtesting)

- A pass to a teammate in open space arrives in ≤ 1 s (short) / ≤ 2 s (long).
- **Responsive controls:** from a button press to the ball leaving the foot takes ≤ 50 ms (3 ticks), checked
  by an automated test ([#24](https://github.com/doig80/fc94/issues/24)).
- A first-time player scores against Easy CPU within their first match.
- Average Normal-difficulty match: 3–6 goals in total. Checked automatically by CPU-vs-CPU balance runs in CI
  ([#26](https://github.com/doig80/fc94/issues/26)), along with pass times and possession balance.
- Goalkeepers save most long shots but are beatable with curl, power and angles.

## Out of scope for v1

Substitutions and preset formations (both planned for **v1.1**, see [30](30-milestones.md); v1 uses one
4-4-2 for every team), a free-form tactics editor, injuries, skill-move combos, manual goalkeeper control
(keepers are always AI).
