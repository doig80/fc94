import type { SimParams } from "../sim/params";
import { TUNING_GROUPS, type TuningField } from "./tuningSchema";

/** Tuned values in the same shape as SimParams, e.g. `{ "action": { "passArrivalSpeed": 9 } }`. */
export type TuningChanges = Partial<Record<keyof SimParams, Record<string, number>>>;

const FIELDS = TUNING_GROUPS.flatMap((g) => g.fields);

export function getValue(params: SimParams, f: TuningField): number {
  return (params[f.section] as unknown as Record<string, number>)[f.key];
}

export function setValue(params: SimParams, f: TuningField, value: number): void {
  (params[f.section] as unknown as Record<string, number>)[f.key] = value;
}

/** The values that differ from the defaults: what "Copy changes" puts on the clipboard. */
export function changes(params: SimParams, defaults: SimParams): TuningChanges {
  const out: TuningChanges = {};
  for (const f of FIELDS) {
    const value = getValue(params, f);
    if (value !== getValue(defaults, f)) (out[f.section] ??= {})[f.key] = value;
  }
  return out;
}

/** Apply pasted or saved changes. Unknown names and non-numbers are skipped; returns how many were applied. */
export function applyChanges(params: SimParams, input: unknown): number {
  if (typeof input !== "object" || input === null) return 0;
  let applied = 0;
  for (const f of FIELDS) {
    const section = (input as Record<string, unknown>)[f.section];
    if (typeof section !== "object" || section === null) continue;
    const value = (section as Record<string, unknown>)[f.key];
    if (typeof value === "number" && Number.isFinite(value)) {
      setValue(params, f, value);
      applied++;
    }
  }
  return applied;
}

/** A value as the panel shows it: ticks in seconds, fractions in percent. */
export function formatValue(f: TuningField, value: number): string {
  if (f.unit === "switch") return value > 0 ? "on" : "off";
  if (f.unit === "ticks") return `${(value / 60).toFixed(2)} s`;
  if (f.unit === "%") return `${Math.round(value * 100)} %`;
  const decimals = f.step >= 1 ? 0 : f.step >= 0.1 ? 1 : f.step >= 0.01 ? 2 : 3;
  return f.unit ? `${value.toFixed(decimals)} ${f.unit}` : value.toFixed(decimals);
}
