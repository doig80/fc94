import { longBallPower, matchMinute, type MatchEvent, type MatchState, type SimParams } from "../sim";

/** On-screen match information (docs/specs/10 §7): scoreboard, referee calls, meters, pause menu, replay badge. */

/** What the banner says for each referee call (none for a kick-off). */
const CALLS: Partial<Record<MatchEvent["kind"], string>> = {
  goal: "GOAL!",
  kickoff: "Kick-off",
  foul: "Foul",
  advantage: "Advantage",
  offside: "Offside",
  freekick: "Free kick",
  penalty: "Penalty!",
  corner: "Corner",
  kickin: "Kick-in",
  goalkick: "Goal kick",
  halftime: "Half-time",
  extratime: "Extra time",
  shootout: "Penalties",
  scored: "Scored!",
  missed: "Missed!",
  fulltime: "Full time",
};
/** Big banners; the others are small, so play stays visible. */
const BIG = new Set<MatchEvent["kind"]>(["goal", "halftime", "extratime", "shootout", "fulltime"]);
/** How long a call stays on screen. */
const BANNER_TICKS = 100;
const TEAMS = [
  { name: "Home", colour: "#b3101e" },
  { name: "Away", colour: "#1b4fd8" },
];

function element(className: string, html = ""): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

/** The score, with the shoot-out score once there is one: "1 – 1 (4–3)". */
function scoreText(s: MatchState): string {
  const so = s.shootout;
  const pens = so ? ` (${so.kicks[0].filter(Boolean).length}–${so.kicks[1].filter(Boolean).length})` : "";
  return `${s.score[0]} – ${s.score[1]}${pens}`;
}

/** A player as the banner names them: team and shirt number (the keeper is 1). */
function playerName(s: MatchState, i: number): string {
  const teamSize = s.players.length / 2;
  return `${TEAMS[s.players[i].team].name} No. ${(i % teamSize) + 1}`;
}

/** Score, match clock and each team's cards, top centre. */
export function scoreboard(params: SimParams): { update(s: MatchState): void } {
  const chip = (i: number) => `<i style="background:${TEAMS[i].colour}"></i>`;
  const el = element(
    "scoreboard",
    `<span class="team">${chip(0)}${TEAMS[0].name}<span class="cards"></span></span><b class="score"></b>` +
      `<span class="team"><span class="cards"></span>${TEAMS[1].name}${chip(1)}</span><span class="clock"></span>`,
  );
  const score = el.querySelector<HTMLElement>(".score")!;
  const clock = el.querySelector<HTMLElement>(".clock")!;
  const cards = [...el.querySelectorAll<HTMLElement>(".cards")];
  let shown = "";
  return {
    update(s) {
      score.textContent = scoreText(s);
      clock.textContent = s.shootout ? "Pens" : `${matchMinute(s, params)}'`;
      // A yellow for each booked player still on, a red for each sent off.
      const key = s.players.map((p) => (p.sentOff ? "r" : p.yellows > 0 ? "y" : "")).join(",");
      if (key === shown) return;
      shown = key;
      cards.forEach((el, team) => {
        const mine = s.players.filter((p) => p.team === team);
        const card = (red: boolean) => `<b class="card ${red ? "red" : "yellow"}"></b>`;
        el.innerHTML =
          mine
            .filter((p) => !p.sentOff && p.yellows > 0)
            .map(() => card(false))
            .join("") +
          mine
            .filter((p) => p.sentOff)
            .map(() => card(true))
            .join("");
      });
    },
  };
}

/** The referee's latest call, shown for a moment (full time stays up). */
export function callBanner(): { update(s: MatchState): void; hide(): void } {
  const el = element("match-banner", `<span class="call"></span><span class="sub"></span>`);
  el.hidden = true;
  const call = el.querySelector<HTMLElement>(".call")!;
  const sub = el.querySelector<HTMLElement>(".sub")!;
  return {
    update(s) {
      const e = s.lastEvent;
      const text = e ? CALLS[e.kind] : undefined;
      if (!e || !text || (e.kind !== "fulltime" && s.tick - e.tick > BANNER_TICKS)) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.classList.toggle("big", BIG.has(e.kind));
      call.textContent = text;
      sub.textContent = BIG.has(e.kind) ? `${TEAMS[0].name} ${scoreText(s)} ${TEAMS[1].name}` : "";
      if (e.kind === "scored" || e.kind === "missed")
        sub.textContent = `${TEAMS[e.team].name} · ${scoreText(s)}`;
      if (e.card) sub.textContent = `${e.card.red ? "Red" : "Yellow"} card · ${playerName(s, e.card.player)}`;
      sub.dataset.card = e.card ? (e.card.red ? "red" : "yellow") : "";
      if (e.kind === "fulltime") sub.textContent += " · R (or Back) to play again";
    },
    hide() {
      el.hidden = true;
    },
  };
}

/** "Perfect!" for a first-time shot struck at just the right moment (M4); a quick pop over the play. */
export function perfectPop(): { update(s: MatchState): void } {
  const el = element("perfect-pop", "Perfect!");
  el.hidden = true;
  let shown = -1;
  return {
    update(s) {
      const p = s.lastPerfect;
      const fresh = p !== null && s.tick - p.tick < 50;
      el.hidden = !fresh;
      if (fresh && p.tick !== shown) {
        shown = p.tick;
        // Restart the pop animation.
        el.classList.remove("pop");
        void el.offsetWidth;
        el.classList.add("pop");
      }
    },
  };
}

/**
 * Shot power (fills while shoot is held, docs/specs/10 §3), the long ball's distance (while lob is held) and sprint
 * stamina of the controlled player.
 */
export function hudMeters(params: SimParams): { update(s: MatchState): void } {
  const el = element(
    "hud-meters",
    `<div class="meter power" hidden><span></span></div><div class="meter stamina"><span></span></div>`,
  );
  const power = el.querySelector<HTMLElement>(".power")!;
  const powerFill = power.querySelector("span")!;
  const staminaFill = el.querySelector<HTMLElement>(".stamina span")!;
  return {
    update(s) {
      const p = s.players[s.controllers[0].player];
      const shooting = p.charge >= 0;
      // The long-ball bar shows once lob is held longer than a tap.
      const long = !shooting && p.lobCharge >= params.action.lobTapTicks;
      power.hidden = !shooting && !long;
      const level = shooting ? p.charge / params.action.shotChargeTicks : longBallPower(p.lobCharge, params);
      powerFill.style.width = `${level * 100}%`;
      power.classList.toggle("over", shooting && level > params.action.overpowerAt);
      power.classList.toggle("long", long);
      staminaFill.style.width = `${p.stamina * 100}%`;
      staminaFill.classList.toggle("low", p.stamina < 0.25);
    },
  };
}

const KEYBOARD_HELP = `<strong>Controls</strong> <span class="muted">(H hides)</span><br>
    <kbd>W A S D</kbd> run · <kbd>Space</kbd> sprint<br>
    <b>With the ball:</b> <kbd>J</kbd> pass (tap twice: one-two) · hold <kbd>K</kbd> shoot (steer to curl) ·
    <kbd>L</kbd> lob / cross / through ball (hold: long ball)<br>
    <b>Just after a shot:</b> steer to bend it · pull back to lift · push on to dip<br>
    <b>Free kicks and penalties:</b> steer to move the yellow ring, hold <kbd>K</kbd> to shoot at it ·
    <b>corners:</b> steer the ring, <kbd>L</kbd> to cross to it<br>
    <b>Defending:</b> <kbd>J</kbd> switch player · <kbd>K</kbd> tackle · <kbd>L</kbd> slide<br>
    <kbd>Esc</kbd> pause · <kbd>R</kbd> restart`;

/** The same, on a pad (docs/specs/10 §3): Xbox buttons, PlayStation in brackets. */
const PAD_HELP = `<strong>Controls</strong> <span class="muted">(Y hides)</span><br>
    <kbd>Left stick</kbd> run · <kbd>RT</kbd> (R2) sprint<br>
    <b>With the ball:</b> <kbd>A</kbd> (✕) pass (tap twice: one-two) · hold <kbd>B</kbd> (○) shoot (steer to curl) ·
    <kbd>X</kbd> (□) lob / cross / through ball (hold: long ball)<br>
    <b>Just after a shot:</b> steer to bend it · pull back to lift · push on to dip<br>
    <b>Free kicks and penalties:</b> steer to move the yellow ring, hold <kbd>B</kbd> (○) to shoot at it ·
    <b>corners:</b> steer the ring, <kbd>X</kbd> (□) to cross to it<br>
    <b>Defending:</b> <kbd>A</kbd> (✕) switch player · <kbd>B</kbd> (○) tackle · <kbd>X</kbd> (□) slide<br>
    <kbd>Start</kbd> pause · <kbd>Back</kbd> restart`;

/** The controls, for the keyboard or, once a pad is connected, the pad. */
export function controlsHelp(): HTMLElement & { usePad(on: boolean): void } {
  const tune = new URLSearchParams(location.search).has("tune") ? " · <kbd>T</kbd> tuning panel" : "";
  const el = element("controls-help", KEYBOARD_HELP + tune);
  let pad = false;
  return Object.assign(el, {
    usePad(on: boolean) {
      if (on === pad) return;
      pad = on;
      el.innerHTML = on ? PAD_HELP : KEYBOARD_HELP + tune;
    },
  });
}

/** The pause menu (N1): resume, restart, controls. */
export function pauseMenu(actions: { resume(): void; restart(): void; help(): void }): HTMLElement {
  const el = element(
    "pause-menu",
    `<h2>Paused</h2>
    <button type="button" data-act="resume">Resume <kbd>Esc</kbd></button>
    <button type="button" data-act="restart">Restart <kbd>R</kbd></button>
    <button type="button" data-act="help">Controls <kbd>H</kbd></button>`,
  );
  el.hidden = true;
  el.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).closest("button")?.dataset.act;
    if (act === "resume") actions.resume();
    if (act === "restart") actions.restart();
    if (act === "help") actions.help();
  });
  return el;
}

export function replayBadge(): HTMLElement {
  const el = element(
    "replay-badge",
    `<span class="dot"></span>REPLAY <span class="label"></span><span class="muted">Space to skip</span>`,
  );
  el.hidden = true;
  return el;
}

/**
 * An arrow at the edge of the screen pointing at your player when they're out of shot (readability, G7).
 * `at` is the player's screen position as fractions of the canvas.
 */
export function offscreenMarker(): { update(at: { x: number; y: number }): void } {
  const el = element("offscreen-marker", `<span>▲</span>`);
  el.hidden = true;
  const arrow = el.querySelector<HTMLElement>("span")!;
  const margin = 0.04;
  return {
    update(at) {
      const inside = at.x >= 0 && at.x <= 1 && at.y >= 0 && at.y <= 1;
      el.hidden = inside;
      if (inside) return;
      const x = Math.min(1 - margin, Math.max(margin, at.x));
      const y = Math.min(1 - margin, Math.max(margin, at.y));
      el.style.left = `${x * 100}%`;
      el.style.top = `${y * 100}%`;
      const angle = Math.atan2(at.y - 0.5, at.x - 0.5) + Math.PI / 2;
      arrow.style.transform = `rotate(${angle}rad)`;
    },
  };
}
