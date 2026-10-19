import { SceneInstrumentation } from "@babylonjs/core";
import { KeyboardInput } from "../input/keyboard";
import { createEngine } from "../render/engine";
import { showInspector } from "../render/inspector";
import { MatchView } from "../render/matchView";
import {
  cloneParams,
  cloneState,
  controlledPlayers,
  createMatch,
  DEFAULT_PARAMS,
  DT,
  isInGoal,
  PITCH_5_A_SIDE,
  stepMatch,
  type MatchState,
  type SimParams,
} from "../sim";
import { FixedStepper } from "./fixedStepper";
import { mountTuningPanel } from "../ui/tuningPanel";
import { parseMatchOptions, type MatchOptions } from "./options";

declare global {
  interface Window {
    /** Test hooks: `ready` after the first frames, plus read access to the live match. */
    __match?: { ready: boolean; renderer: string; state: () => MatchState; params: () => SimParams };
  }
}

/** How long a goal or an out-of-play ball is shown before play restarts (placeholder until the rules, #13). */
const RESTART_TICKS = 90;

/** The vertical-slice match: 5-a-side on a small pitch, 1 player vs CPU on the keyboard (docs/specs/30 §1). */
export async function startMatch(): Promise<void> {
  const options = parseMatchOptions(window.location.search, window.matchMedia("(pointer: coarse)").matches);
  document.getElementById("panel")?.remove();
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const { engine, renderer } = await createEngine(canvas, options.renderer);
  const dpr = Math.min(window.devicePixelRatio, options.quality === "low" ? 1.25 : 2);
  engine.setHardwareScalingLevel(1 / dpr);

  // The live gameplay constants: the tuning panel edits this copy while the match runs.
  const params = cloneParams(DEFAULT_PARAMS);
  if (options.tune) mountTuningPanel(params);
  let state = newMatch(options);
  let prev = cloneState(state);
  const view = new MatchView(engine, state, options);
  const keyboard = new KeyboardInput(window);
  const stepper = new FixedStepper(DT);
  const banner = overlay("match-banner");
  const help = controlsHelp();
  const meters = hudMeters(params);
  let restartIn = -1;

  window.__match = { ready: false, renderer, state: () => state, params: () => params };
  const status = options.debug ? overlay("debug-overlay") : undefined;
  const drawCalls = options.debug ? new SceneInstrumentation(view.scene).drawCallsCounter : undefined;
  if (options.inspector) void showInspector(view.scene);

  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyR") restart();
    if (e.code === "KeyH") help.hidden = !help.hidden;
  });

  function restart(): void {
    state = newMatch(options);
    prev = cloneState(state);
    restartIn = -1;
    banner.hidden = true;
  }

  let last = performance.now();
  let frames = 0;
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const alpha = stepper.advance(dt, () => {
      prev = cloneState(state);
      stepMatch(state, [keyboard.read(view.rig.yaw)], params);
      if (restartIn < 0) {
        const goal = isInGoal(state.ball, state.pitch, params.ball.radius);
        if (goal !== 0 || outOfPlay(state)) {
          restartIn = RESTART_TICKS;
          banner.textContent = goal !== 0 ? "GOAL!" : "Out of play";
          banner.hidden = false;
        }
      } else if (--restartIn === 0) {
        if (banner.textContent === "GOAL!") restart();
        else replaceBall(state);
        restartIn = -1;
        banner.hidden = true;
      }
    });
    view.render(prev, state, alpha, dt, controlledPlayers(state));
    meters.update(state);
    view.scene.render();
    if (++frames === 30) {
      window.__match!.ready = true;
      document.body.dataset.ready = "1";
    }
    if (status && frames % 30 === 0) {
      const calls = drawCalls?.current ?? 0;
      status.textContent = `${renderer} · ${options.quality} · ${engine.getFps().toFixed(0)} fps · ${calls} draw calls · tick ${state.tick}`;
    }
  });
  window.addEventListener("resize", () => engine.resize());
}

function newMatch(options: MatchOptions): MatchState {
  return createMatch({ seed: options.seed, pitch: PITCH_5_A_SIDE, teamSize: 5, weather: options.weather });
}

function outOfPlay(s: MatchState): boolean {
  const b = s.ball.pos;
  const r = DEFAULT_PARAMS.ball.radius;
  return Math.abs(b.x) > s.pitch.length / 2 + r || Math.abs(b.z) > s.pitch.width / 2 + r;
}

/** Placeholder restart: the ball comes back 1 m inside the line, loose. Proper restarts arrive with #13. */
function replaceBall(s: MatchState): void {
  const halfL = s.pitch.length / 2 - 1;
  const halfW = s.pitch.width / 2 - 1;
  const b = s.ball;
  b.pos = {
    x: Math.max(-halfL, Math.min(halfL, b.pos.x)),
    y: DEFAULT_PARAMS.ball.radius,
    z: Math.max(-halfW, Math.min(halfW, b.pos.z)),
  };
  b.vel = { x: 0, y: 0, z: 0 };
  b.spin = { x: 0, y: 0, z: 0 };
  b.owner = -1;
  b.intendedReceiver = -1;
  b.touchBlockUntil = 0;
}

function overlay(className: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  el.hidden = className === "match-banner";
  document.body.append(el);
  return el;
}

/** Shot power (fills while shoot is held, docs/specs/10 §3) and sprint stamina of the controlled player. */
function hudMeters(params: SimParams): { update(s: MatchState): void } {
  const el = document.createElement("div");
  el.className = "hud-meters";
  el.innerHTML = `<div class="meter power" hidden><span></span></div><div class="meter stamina"><span></span></div>`;
  document.body.append(el);
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

function controlsHelp(): HTMLElement {
  const el = document.createElement("div");
  el.className = "controls-help";
  el.innerHTML = `<strong>Controls</strong> <span class="muted">(H hides)</span><br>
    <kbd>W A S D</kbd> run · <kbd>Space</kbd> sprint<br>
    <b>With the ball:</b> <kbd>J</kbd> pass (tap twice: one-two) · hold <kbd>K</kbd> shoot (steer to curl) ·
    <kbd>L</kbd> lob / cross / through ball<br>
    <b>Defending:</b> <kbd>J</kbd> switch player · <kbd>K</kbd> tackle · <kbd>L</kbd> slide<br>
    <kbd>R</kbd> restart${new URLSearchParams(location.search).has("tune") ? " · <kbd>T</kbd> tuning panel" : ""}`;
  document.body.append(el);
  return el;
}
