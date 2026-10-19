import { matchMinute, type MatchEvent, type MatchState, type SimParams } from "../sim";

/** On-screen match information (docs/specs/10 §7): scoreboard, referee calls, meters, pause menu, replay badge. */

/** What the banner says for each referee call (none for a kick-off). */
const CALLS: Partial<Record<MatchEvent["kind"], string>> = {
  goal: "GOAL!",
  foul: "Foul",
  advantage: "Advantage",
  freekick: "Free kick",
  penalty: "Penalty!",
  corner: "Corner",
  kickin: "Kick-in",
  goalkick: "Goal kick",
  halftime: "Half-time",
  fulltime: "Full time",
};
/** Big banners; the others are small, so play stays visible. */
const BIG = new Set<MatchEvent["kind"]>(["goal", "halftime", "fulltime"]);
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

/** Score and match clock, top centre. */
export function scoreboard(): { update(s: MatchState): void } {
  const chip = (i: number) => `<i style="background:${TEAMS[i].colour}"></i>`;
  const el = element(
    "scoreboard",
    `<span class="team">${chip(0)}${TEAMS[0].name}</span><b class="score"></b>` +
      `<span class="team">${TEAMS[1].name}${chip(1)}</span><span class="clock"></span>`,
  );
  const score = el.querySelector<HTMLElement>(".score")!;
  const clock = el.querySelector<HTMLElement>(".clock")!;
  return {
    update(s) {
      score.textContent = `${s.score[0]} – ${s.score[1]}`;
      clock.textContent = `${matchMinute(s)}'`;
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
      const [home, away] = s.score;
      sub.textContent = BIG.has(e.kind) ? `${TEAMS[0].name} ${home} – ${away} ${TEAMS[1].name}` : "";
      if (e.kind === "fulltime") sub.textContent += " · R to play again";
    },
    hide() {
      el.hidden = true;
    },
  };
}

/** Shot power (fills while shoot is held, docs/specs/10 §3) and sprint stamina of the controlled player. */
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
      power.hidden = p.charge < 0;
      const level = Math.max(0, p.charge) / params.action.shotChargeTicks;
      powerFill.style.width = `${level * 100}%`;
      power.classList.toggle("over", level > params.action.overpowerAt);
      staminaFill.style.width = `${p.stamina * 100}%`;
      staminaFill.classList.toggle("low", p.stamina < 0.25);
    },
  };
}

export function controlsHelp(): HTMLElement {
  return element(
    "controls-help",
    `<strong>Controls</strong> <span class="muted">(H hides)</span><br>
    <kbd>W A S D</kbd> run · <kbd>Space</kbd> sprint<br>
    <b>With the ball:</b> <kbd>J</kbd> pass (tap twice: one-two) · hold <kbd>K</kbd> shoot (steer to curl) ·
    <kbd>L</kbd> lob / cross / through ball<br>
    <b>Just after a shot:</b> steer to bend it · pull back to lift · push on to dip<br>
    <b>Free kicks and penalties:</b> steer to move the yellow ring, hold <kbd>K</kbd> to shoot at it<br>
    <b>Defending:</b> <kbd>J</kbd> switch player · <kbd>K</kbd> tackle · <kbd>L</kbd> slide<br>
    <kbd>Esc</kbd> pause · <kbd>R</kbd> restart${new URLSearchParams(location.search).has("tune") ? " · <kbd>T</kbd> tuning panel" : ""}`,
  );
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
