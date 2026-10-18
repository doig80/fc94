import type { MatchCamera } from "../render/cameraRig";
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
  debug: boolean;
}

function pick<T extends string>(values: readonly T[], raw: string | null, fallback: T): T {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseMatchOptions(search: string, isMobile: boolean): MatchOptions {
  const params = new URLSearchParams(search);
  const seed = Number.parseInt(params.get("seed") ?? "", 10);
  const debug = params.get("debug");
  return {
    time: pick(TIMES, params.get("time"), "day"),
    weather: pick(WEATHERS, params.get("weather"), "clear"),
    quality: pick(QUALITIES, params.get("quality"), isMobile ? "low" : "high"),
    camera: pick(["classic", "broadcast"] as const, params.get("camera"), "classic"),
    renderer: pick(RENDERERS, params.get("renderer"), "auto"),
    seed: Number.isFinite(seed) ? seed : 1994,
    debug: debug !== null && debug !== "0" && debug !== "false",
  };
}
