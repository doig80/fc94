/** Shared presentation settings (look-test and match). */
export const LOOKS = ["stylised", "toon"] as const;
export const TIMES = ["day", "dusk", "night"] as const;
export const WEATHERS = ["clear", "rain", "snow"] as const;
export const QUALITIES = ["low", "high"] as const;
export const RENDERERS = ["auto", "webgpu", "webgl"] as const;

export type Look = (typeof LOOKS)[number];
export type TimeOfDay = (typeof TIMES)[number];
export type Weather = (typeof WEATHERS)[number];
export type Quality = (typeof QUALITIES)[number];
export type RendererPref = (typeof RENDERERS)[number];
