/** Look-test settings. All of them can be set from the URL, e.g. `?look=toon&time=night&weather=rain`. */
import {
  LOOKS,
  QUALITIES,
  RENDERERS,
  TIMES,
  WEATHERS,
  type Look,
  type Quality,
  type RendererPref,
  type TimeOfDay,
  type Weather,
} from "../render/types";

export { LOOKS, QUALITIES, RENDERERS, TIMES, WEATHERS };
export type { Look, Quality, RendererPref, TimeOfDay, Weather };
export const CAMERAS = ["classic", "broadcast", "orbit"] as const;
export type CameraMode = (typeof CAMERAS)[number];

export interface LookTestOptions {
  look: Look;
  time: TimeOfDay;
  weather: Weather;
  quality: Quality;
  camera: CameraMode;
  renderer: RendererPref;
  /** Freeze animation at a fixed moment (used for repeatable screenshots). */
  freeze: boolean;
  /** Hide the settings panel (used for screenshots). */
  hideUi: boolean;
  debug: boolean;
  /** Optional exact camera for art review: `view=alpha,beta,radius,targetX,targetZ`. */
  view?: [number, number, number, number, number];
}

export const DEFAULTS: Omit<LookTestOptions, "quality"> = {
  look: "stylised",
  time: "day",
  weather: "clear",
  camera: "classic",
  renderer: "auto",
  freeze: false,
  hideUi: false,
  debug: false,
};

function pickEnum<T extends string>(values: readonly T[], raw: string | null, fallback: T): T {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function flag(params: URLSearchParams, name: string): boolean {
  const raw = params.get(name);
  return raw !== null && raw !== "0" && raw !== "false";
}

/** Phones and tablets start on the Low preset; everything else on High. */
export function defaultQuality(isMobile: boolean): Quality {
  return isMobile ? "low" : "high";
}

export function parseOptions(search: string, isMobile: boolean): LookTestOptions {
  const params = new URLSearchParams(search);
  return {
    look: pickEnum(LOOKS, params.get("look"), DEFAULTS.look),
    time: pickEnum(TIMES, params.get("time"), DEFAULTS.time),
    weather: pickEnum(WEATHERS, params.get("weather"), DEFAULTS.weather),
    quality: pickEnum(QUALITIES, params.get("quality"), defaultQuality(isMobile)),
    camera: pickEnum(CAMERAS, params.get("camera"), DEFAULTS.camera),
    renderer: pickEnum(RENDERERS, params.get("renderer"), DEFAULTS.renderer),
    freeze: flag(params, "freeze"),
    hideUi: flag(params, "hideui"),
    debug: flag(params, "debug"),
    view: parseView(params.get("view")),
  };
}

function parseView(raw: string | null): LookTestOptions["view"] {
  const parts = raw?.split(",").map(Number);
  return parts && parts.length === 5 && parts.every(Number.isFinite)
    ? (parts as LookTestOptions["view"])
    : undefined;
}

/** Query string for the user-facing settings, so a view can be shared as a link. */
export function toSearch(o: LookTestOptions): string {
  const params = new URLSearchParams({
    mode: "looktest",
    look: o.look,
    time: o.time,
    weather: o.weather,
    quality: o.quality,
    camera: o.camera,
  });
  return `?${params.toString()}`;
}
