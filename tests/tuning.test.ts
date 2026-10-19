import { describe, expect, it } from "vitest";
import { cloneParams, DEFAULT_PARAMS } from "../src/sim";
import { applyChanges, changes, formatValue, getValue } from "../src/ui/tuning";
import { NOT_TUNABLE, TUNING_GROUPS } from "../src/ui/tuningSchema";

const FIELDS = TUNING_GROUPS.flatMap((g) => g.fields);
const field = (path: string) => FIELDS.find((f) => `${f.section}.${f.key}` === path)!;

describe("tuning schema", () => {
  it("covers every gameplay constant, so a new one can't be forgotten", () => {
    const inSchema = new Set(FIELDS.map((f) => `${f.section}.${f.key}`));
    const all = Object.entries(DEFAULT_PARAMS).flatMap(([section, values]) =>
      Object.keys(values).map((key) => `${section}.${key}`),
    );
    expect(all.filter((p) => !inSchema.has(p) && !NOT_TUNABLE.includes(p))).toEqual([]);
    expect([...inSchema].filter((p) => !all.includes(p))).toEqual([]);
    expect(inSchema.size).toBe(FIELDS.length); // no duplicates
  });

  it("puts every default inside its slider's range", () => {
    for (const f of FIELDS) {
      const v = getValue(DEFAULT_PARAMS, f);
      expect(v, `${f.section}.${f.key}`).toBeGreaterThanOrEqual(f.min);
      expect(v, `${f.section}.${f.key}`).toBeLessThanOrEqual(f.max);
    }
  });
});

describe("tuning changes", () => {
  it("lists only what differs from the defaults", () => {
    const p = cloneParams(DEFAULT_PARAMS);
    expect(changes(p, DEFAULT_PARAMS)).toEqual({});
    p.action.passArrivalSpeed = 10;
    p.ball.gravity = 8;
    expect(changes(p, DEFAULT_PARAMS)).toEqual({ action: { passArrivalSpeed: 10 }, ball: { gravity: 8 } });
  });

  it("applies pasted changes and ignores anything it doesn't know", () => {
    const p = cloneParams(DEFAULT_PARAMS);
    const n = applyChanges(p, {
      action: { passArrivalSpeed: 10, made_up: 3, shotMaxSpeed: "fast" },
      nonsense: { x: 1 },
      ball: { radius: 5 },
    });
    expect(n).toBe(1);
    expect(p.action.passArrivalSpeed).toBe(10);
    expect(p.action.shotMaxSpeed).toBe(DEFAULT_PARAMS.action.shotMaxSpeed);
    expect(p.ball.radius).toBe(DEFAULT_PARAMS.ball.radius);
    expect(applyChanges(p, "not an object")).toBe(0);
  });

  it("round-trips through JSON", () => {
    const p = cloneParams(DEFAULT_PARAMS);
    p.player.runSpeed = 7.2;
    const copy = cloneParams(DEFAULT_PARAMS);
    applyChanges(copy, JSON.parse(JSON.stringify(changes(p, DEFAULT_PARAMS))));
    expect(copy).toEqual(p);
  });
});

describe("formatValue", () => {
  it("shows ticks as seconds and fractions as percent", () => {
    expect(formatValue(field("action.bufferTicks"), 18)).toBe("0.30 s");
    expect(formatValue(field("action.tackleSuccess"), 0.6)).toBe("60 %");
    expect(formatValue(field("action.passArrivalSpeed"), 8)).toBe("8.0 m/s");
  });
});
