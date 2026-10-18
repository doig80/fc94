import { createEngine } from "../render/engine";
import { MatchView } from "../render/matchView";
import {
  cloneState,
  createMatch,
  DEFAULT_PARAMS,
  DT,
  idleIntents,
  PITCH_5_A_SIDE,
  step,
  type MatchState,
} from "../sim";
import { FixedStepper } from "./fixedStepper";
import { parseMatchOptions } from "./options";

declare global {
  interface Window {
    /** Test hooks: `ready` after the first frames, plus read access to the live match. */
    __match?: { ready: boolean; renderer: string; state: () => MatchState };
  }
}

/** The vertical-slice match: 5-a-side on a small pitch (docs/specs/30 §1). */
export async function startMatch(): Promise<void> {
  const options = parseMatchOptions(window.location.search, window.matchMedia("(pointer: coarse)").matches);
  document.getElementById("panel")?.remove();
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const { engine, renderer } = await createEngine(canvas, options.renderer);
  const dpr = Math.min(window.devicePixelRatio, options.quality === "low" ? 1.25 : 2);
  engine.setHardwareScalingLevel(1 / dpr);

  const state = createMatch({
    seed: options.seed,
    pitch: PITCH_5_A_SIDE,
    teamSize: 5,
    weather: options.weather,
  });
  let prev = cloneState(state);
  const view = new MatchView(engine, state, options);
  const intents = idleIntents(state.players.length);
  const stepper = new FixedStepper(DT);
  const controlled = [4];

  window.__match = { ready: false, renderer, state: () => state };
  const status = options.debug ? debugOverlay() : undefined;

  let last = performance.now();
  let frames = 0;
  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const alpha = stepper.advance(dt, () => {
      prev = cloneState(state);
      step(state, intents, DEFAULT_PARAMS);
    });
    view.render(prev, state, alpha, dt, controlled);
    view.scene.render();
    if (++frames === 30) {
      window.__match!.ready = true;
      document.body.dataset.ready = "1";
    }
    if (status && frames % 30 === 0)
      status.textContent = `${renderer} · ${engine.getFps().toFixed(0)} fps · tick ${state.tick}`;
  });
  window.addEventListener("resize", () => engine.resize());
}

function debugOverlay(): HTMLElement {
  const el = document.createElement("div");
  el.className = "debug-overlay";
  document.body.append(el);
  return el;
}
