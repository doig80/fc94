import { SceneInstrumentation } from "@babylonjs/core";
import { combine, GamepadInput, PAD } from "../input/gamepad";
import { KeyboardInput } from "../input/keyboard";
import { createEngine } from "../render/engine";
import { showInspector } from "../render/inspector";
import { MatchView } from "../render/matchView";
import {
  aiIntents,
  applyDifficulty,
  cloneParams,
  cloneState,
  controlledPlayers,
  createMatch,
  DEFAULT_PARAMS,
  DIFFICULTY,
  DT,
  PITCH_5_A_SIDE,
  PITCH_FULL,
  startShootout,
  stepMatch,
  TICK_RATE,
  type MatchState,
  type SimParams,
} from "../sim";
import { FixedStepper } from "./fixedStepper";
import {
  callBanner,
  controlsHelp,
  hudMeters,
  offscreenMarker,
  pauseMenu,
  perfectPop,
  replayBadge,
  scoreboard,
} from "./hud";
import { ReplayPlayer, ReplayRecorder } from "./replay";
import { mountTuningPanel } from "../ui/tuningPanel";
import { parseMatchOptions, type MatchOptions } from "./options";

declare global {
  interface Window {
    /** Test hooks: `ready` after the first frames, plus read access to the live match. */
    __match?: {
      ready: boolean;
      renderer: string;
      state: () => MatchState;
      params: () => SimParams;
      mode: () => "live" | "paused" | "replay";
      /** How far the replay has got (0..1), or null when none is playing. */
      replayProgress: () => number | null;
      /** Draw calls in the last frame (docs/specs/01 §4 budget). */
      drawCalls: () => number;
    };
  }
}

/** How long into a goal celebration the replay starts, and how much play it shows. */
const REPLAY_AFTER_TICKS = 60;
const REPLAY_SECONDS = 5;
/** The last part of a replay runs in slow motion. */
const SLOW_FROM = 0.75;

/** The match: 11 v 11 on a full pitch (`?size=5`: 5-a-side), 1 player vs CPU on the keyboard (docs/specs/30). */
export async function startMatch(): Promise<void> {
  const options = parseMatchOptions(window.location.search, window.matchMedia("(pointer: coarse)").matches);
  document.getElementById("panel")?.remove();
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const { engine, renderer } = await createEngine(canvas, options.renderer);
  const dpr = Math.min(window.devicePixelRatio, options.quality === "low" ? 1.25 : 2);
  engine.setHardwareScalingLevel(1 / dpr);

  // The live gameplay constants: the tuning panel edits this copy while the match runs.
  const params = cloneParams(DEFAULT_PARAMS);
  applyDifficulty(params, options.difficulty);
  if (options.tune) mountTuningPanel(params);
  const cpu = options.cpu ? (s: MatchState) => aiIntents(s, params) : undefined;
  let state = newMatch(options);
  let prev = cloneState(state);
  const view = new MatchView(engine, state, { ...options, juice: params.juice });
  const keyboard = new KeyboardInput(window);
  const pad = new GamepadInput();
  const stepper = new FixedStepper(DT);
  const replayStepper = new FixedStepper(DT);
  const recorder = new ReplayRecorder();
  const banner = callBanner();
  const help = controlsHelp();
  const meters = hudMeters(params);
  const board = scoreboard(params);
  const badge = replayBadge();
  const marker = offscreenMarker();
  const perfect = perfectPop();
  const menu = pauseMenu({
    resume: () => setPaused(false),
    restart: () => restart(),
    help: () => (help.hidden = !help.hidden),
  });
  let paused = false;
  let replay: { player: ReplayPlayer; goalX: number; hold: number; slow: boolean } | null = null;
  /** Seconds the picture stays frozen (hit-stop on power shots and goals). */
  let freeze = 0;
  let replayedGoal = -1;
  let perfectSeen = -1;

  const drawCalls = new SceneInstrumentation(view.scene).drawCallsCounter;
  window.__match = {
    ready: false,
    renderer,
    state: () => state,
    params: () => params,
    mode: () => (paused ? "paused" : replay ? "replay" : "live"),
    replayProgress: () => (replay ? replay.player.progress : null),
    drawCalls: () => drawCalls.current,
  };
  const status = options.debug ? element("debug-overlay") : undefined;
  if (options.inspector) void showInspector(view.scene);

  window.addEventListener("keydown", (e) => {
    if (replay) {
      // Any action key skips the replay.
      if (["Space", "Escape", "KeyJ", "KeyK", "KeyL", "Enter"].includes(e.code)) endReplay();
      return;
    }
    if (e.code === "Escape") setPaused(!paused);
    if (e.code === "KeyR") restart();
    if (e.code === "KeyH") help.hidden = !help.hidden;
  });
  // Leaving the tab pauses the match.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) setPaused(true);
  });

  function setPaused(on: boolean): void {
    paused = on && !replay;
    menu.hidden = !paused;
  }

  function restart(): void {
    state = newMatch(options);
    prev = cloneState(state);
    recorder.clear();
    replay = null;
    badge.hidden = true;
    banner.hide();
    setPaused(false);
  }

  function startReplay(goalTick: number): void {
    const clip = recorder.clip(REPLAY_SECONDS, goalTick);
    if (!clip) return;
    const goalX = (Math.sign(state.ball.pos.x) * state.pitch.length) / 2;
    // A late winner is shown entirely in slow motion.
    const slow = isLateWinner(state, params);
    replay = { player: new ReplayPlayer(clip, params, cpu), goalX, hold: 0, slow };
    badge.querySelector(".label")!.textContent = slow ? "Winning goal" : "";
    badge.hidden = false;
    banner.hide();
  }

  function endReplay(): void {
    replay = null;
    badge.hidden = true;
    // Straight on to the kick-off.
    if (state.phase.kind === "goal") state.phase.until = Math.min(state.phase.until, state.tick + 30);
  }

  /** The pad's menu buttons, as the keys do: Start pauses, Back restarts, Y shows the controls, A/B/X skip a replay. */
  function padButtons(): void {
    const pressed = pad.pressed();
    help.usePad(pad.connected());
    if (pressed.size === 0) return;
    if (replay) {
      if ([PAD.a, PAD.b, PAD.x, PAD.start].some((b) => pressed.has(b))) endReplay();
      return;
    }
    if (pressed.has(PAD.start)) setPaused(!paused);
    if (pressed.has(PAD.back)) restart();
    if (pressed.has(PAD.y)) help.hidden = !help.hidden;
  }

  let last = performance.now();
  let frames = 0;
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    padButtons();
    if (replay) {
      const r = replay.player;
      const speed = replay.slow ? 0.4 : r.progress > SLOW_FROM ? 0.5 : 1;
      const alpha = replayStepper.advance(dt * speed * params.juice.gameSpeed, () => r.step());
      const shot = { kind: r.progress < 0.55 ? ("side" as const) : ("goal" as const), goalX: replay.goalX };
      view.render(r.prev, r.state, alpha, dt, [], shot);
      if (r.done && (replay.hold += dt) > 0.8) endReplay();
    } else {
      let alpha = 1;
      if (freeze > 0) {
        freeze -= dt;
      } else if (!paused) {
        alpha = stepper.advance(dt * params.juice.gameSpeed, () => {
          prev = cloneState(state);
          const keys = keyboard.read(view.rig.yaw);
          const stick = pad.read(view.rig.yaw);
          const intents = [stick ? combine(keys, stick) : keys];
          recorder.record(state, intents);
          stepMatch(state, intents, params, cpu);
          freeze = Math.max(freeze, impact(state, params));
          // A "Perfect" first-time strike (M4) freezes the picture like a power shot.
          const p = state.lastPerfect;
          if (p && p.tick !== perfectSeen) {
            perfectSeen = p.tick;
            rumble(0.6, 120);
            freeze = Math.max(freeze, params.juice.hitStopShotTicks * DT);
          }
        });
      }
      view.render(prev, state, alpha, paused ? 0 : dt, controlledPlayers(state));
      const me = state.players[state.controllers[0].player];
      marker.update(view.screenPosition(me.pos.x, me.pos.z));
      banner.update(state);
      // A moment into the celebration, show the goal again.
      const e = state.lastEvent;
      if (e?.kind === "goal" && e.tick !== replayedGoal && state.tick - e.tick >= REPLAY_AFTER_TICKS) {
        replayedGoal = e.tick;
        startReplay(e.tick);
      }
    }
    meters.update(state);
    board.update(state);
    perfect.update(state);
    view.scene.render();
    if (++frames === 30) {
      window.__match!.ready = true;
      document.body.dataset.ready = "1";
    }
    if (status && frames % 30 === 0) {
      const calls = drawCalls.current;
      status.textContent = `${renderer} · ${options.quality} · ${engine.getFps().toFixed(0)} fps · ${calls} draw calls · tick ${state.tick}`;
    }
  });
  window.addEventListener("resize", () => engine.resize());
}

function newMatch(options: MatchOptions): MatchState {
  const state = createMatch({
    seed: options.seed,
    pitch: options.teamSize === 5 ? PITCH_5_A_SIDE : PITCH_FULL,
    teamSize: options.teamSize,
    weather: options.weather,
    rules: { halfTicks: options.halfMinutes * 60 * TICK_RATE, ...options.rules },
  });
  state.controllers[0].assists = { ...DIFFICULTY[options.difficulty].assists };
  if (options.shootout) startShootout(state, DEFAULT_PARAMS);
  return state;
}

/**
 * Hit-stop (docs/specs/10 §7): how long to freeze the picture after this tick: a power shot or a goal. Rumbles a
 * connected gamepad too.
 */
function impact(state: MatchState, params: SimParams): number {
  const j = params.juice;
  const b = state.ball;
  if (state.lastEvent?.kind === "goal" && state.lastEvent.tick === state.tick) {
    rumble(1, 250);
    return j.hitStopGoalTicks * DT;
  }
  const speed = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
  if (b.owner < 0 && b.kickedAt === state.tick - 1 && speed >= j.powerShotSpeed) {
    rumble(0.6, 120);
    return j.hitStopShotTicks * DT;
  }
  return 0;
}

/** Controller rumble, where the browser and the pad support it. */
function rumble(strength: number, ms: number): void {
  const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
  for (const pad of pads) {
    pad?.vibrationActuator
      ?.playEffect("dual-rumble", { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 })
      .catch(() => {});
  }
}

/** A goal in the last minutes of the second half (or of extra time) that puts the scorer ahead. */
function isLateWinner(state: MatchState, params: SimParams): boolean {
  const e = state.lastEvent;
  if (e?.kind !== "goal" || (state.half !== 2 && state.half !== 4) || !state.rules) return false;
  const length = state.rules.halfTicks * (state.half === 4 ? params.referee.extraTimeShare : 1);
  const late = state.clock >= length * 0.85;
  const lead = state.score[e.team] - state.score[e.team === 0 ? 1 : 0];
  return late && lead === 1;
}

function element(className: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  document.body.append(el);
  return el;
}
