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
  /** `?size=5` plays 5-a-side on the small pitch (quick tests); the default is 11 v 11 (docs/specs/10 §1). */
  teamSize: 5 | 11;
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
  /**
   * The rules (docs/specs/10 §6) until the menus exist: `?offside=0`, `?cards=0`, `?winner=1` (extra time and a
   * shoot-out after a draw) and `?ref=0` (no referee: no fouls, no offside, no cards). Offside is off on Easy.
   */
  rules: { fouls: boolean; offside: boolean; cards: boolean; winner: boolean };
  /** `?shootout=1` starts straight at a penalty shoot-out (playtesting). */
  shootout: boolean;
  /** `?runon=0` switches off the "Run onto the pass" assist (docs/specs/11 §3), on at every level. */
  runOntoPass: boolean;
  /** `?players=new`: the character test's new player model for everyone on the pitch (issue #27). */
  players: "old" | "new";
}

function flag(params: URLSearchParams, name: string): boolean {
  const raw = params.get(name);
  return raw !== null && raw !== "0" && raw !== "false";
}

function pick<T extends string>(values: readonly T[], raw: string | null, fallback: T): T {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** A switch that is on unless the URL says `0` or `false`. */
function onUnless(params: URLSearchParams, name: string, fallback: boolean): boolean {
  const raw = params.get(name);
  return raw === null ? fallback : raw !== "0" && raw !== "false";
}

export function parseMatchOptions(search: string, isMobile: boolean): MatchOptions {
  const params = new URLSearchParams(search);
  const seed = Number.parseInt(params.get("seed") ?? "", 10);
  const difficulty = pick(DIFFICULTIES, params.get("difficulty"), "normal");
  const ref = onUnless(params, "ref", true);
  return {
    time: pick(TIMES, params.get("time"), "day"),
    weather: pick(WEATHERS, params.get("weather"), "clear"),
    quality: pick(QUALITIES, params.get("quality"), isMobile ? "low" : "high"),
    camera: pick(["classic", "broadcast"] as const, params.get("camera"), "classic"),
    renderer: pick(RENDERERS, params.get("renderer"), "auto"),
    seed: Number.isFinite(seed) ? seed : 1994,
    difficulty,
    teamSize: params.get("size") === "5" ? 5 : 11,
    halfMinutes: Number(pick(["2", "3", "5", "10"] as const, params.get("minutes"), "5")),
    debug: flag(params, "debug"),
    inspector: flag(params, "inspector"),
    tune: flag(params, "tune"),
    cpu: params.get("cpu") !== "0",
    rules: {
      fouls: ref,
      offside: ref && onUnless(params, "offside", difficulty !== "easy"),
      cards: ref && onUnless(params, "cards", true),
      winner: flag(params, "winner"),
    },
    shootout: flag(params, "shootout"),
    runOntoPass: onUnless(params, "runon", true),
    players: params.get("players") === "new" ? "new" : "old",
  };
}
