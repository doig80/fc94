import type { MatchCamera } from "../render/cameraRig";
import { DIFFICULTIES, type Difficulty } from "../sim";
import {
  QUALITIES,
  RENDERERS,
  TIMES,
  WEATHERS,
  type Quality,
  type RendererPref,
  type TimeOfDay,
  type Weather,
} from "../render/types";

/** Match settings from the URL until the menus exist (docs/specs/30 §1), e.g. `?weather=rain&time=night`. */
export interface MatchOptions {
  time: TimeOfDay;
  weather: Weather;
  quality: Quality;
  camera: MatchCamera;
  renderer: RendererPref;
  seed: number;
  /** `?difficulty=easy|normal|hard` (docs/specs/11 §2). */
  difficulty: Difficulty;
  /** `?minutes=2|3|5|10`: real minutes per half (docs/specs/10 §1). */
  halfMinutes: number;
  /** `?debug=1`: renderer, quality, fps and draw calls in a corner overlay. */
  debug: boolean;
  /** `?inspector=1`: open the Babylon.js Inspector. */
  inspector: boolean;
  /** `?tune=1`: the tuning panel (docs/specs/02). */
  tune: boolean;
  /** `?cpu=0` freezes the computer players (steady review screenshots and debugging). */
  cpu: boolean;
}

function flag(params: URLSearchParams, name: string): boolean {
  const raw = params.get(name);
  return raw !== null && raw !== "0" && raw !== "false";
}

function pick<T extends string>(values: readonly T[], raw: string | null, fallback: T): T {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseMatchOptions(search: string, isMobile: boolean): MatchOptions {
  const params = new URLSearchParams(search);
  const seed = Number.parseInt(params.get("seed") ?? "", 10);
  return {
    time: pick(TIMES, params.get("time"), "day"),
    weather: pick(WEATHERS, params.get("weather"), "clear"),
    quality: pick(QUALITIES, params.get("quality"), isMobile ? "low" : "high"),
    camera: pick(["classic", "broadcast"] as const, params.get("camera"), "classic"),
    renderer: pick(RENDERERS, params.get("renderer"), "auto"),
    seed: Number.isFinite(seed) ? seed : 1994,
    difficulty: pick(DIFFICULTIES, params.get("difficulty"), "normal"),
    halfMinutes: Number(pick(["2", "3", "5", "10"] as const, params.get("minutes"), "5")),
    debug: flag(params, "debug"),
    inspector: flag(params, "inspector"),
    tune: flag(params, "tune"),
    cpu: params.get("cpu") !== "0",
  };
}
