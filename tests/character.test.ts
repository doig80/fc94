import { describe, expect, it } from "vitest";
import { blendGaits, blendTrack } from "../src/render/character";

/** Idle, walk, jog and sprint as the library has them: the speed each was made for, and one cycle's length. */
const GAITS = [
  { speed: 0, seconds: 2.5 },
  { speed: 0.97, seconds: 1.333 },
  { speed: 5.36, seconds: 0.933 },
  { speed: 8.25, seconds: 0.667 },
];

describe("character test: blending the gaits by speed (issue #27)", () => {
  it("stands still with the idle, sprints flat out with the sprint", () => {
    expect(blendGaits(GAITS, 0).weights).toEqual([1, 0, 0, 0]);
    expect(blendGaits(GAITS, 8.25).weights).toEqual([0, 0, 0, 1]);
    expect(blendGaits(GAITS, 12).weights).toEqual([0, 0, 0, 1]);
  });

  it("between two gaits, mixes just those two, in proportion", () => {
    const { weights } = blendGaits(GAITS, (5.36 + 8.25) / 2);
    expect(weights[0] + weights[1]).toBe(0);
    expect(weights[2]).toBeCloseTo(0.5);
    expect(weights[3]).toBeCloseTo(0.5);
    for (const v of [0.4, 2, 6.5, 9]) {
      const w = blendGaits(GAITS, v).weights;
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
  });

  it("cycles the stride as fast as it covers the ground, so the feet don't slide", () => {
    // At a gait's own speed, one cycle per animation length.
    expect(blendGaits(GAITS, 5.36).perMetre * 5.36).toBeCloseTo(1 / 0.933);
    // Faster than the sprint was made for: the same stride (one cycle per stride's length), cycled faster.
    expect(blendGaits(GAITS, 9).perMetre).toBeCloseTo(1 / (8.25 * 0.667));
    expect(blendGaits(GAITS, 9).perSecond).toBe(0);
    // Standing: the idle breathes at its own pace.
    expect(blendGaits(GAITS, 0)).toMatchObject({ perMetre: 0, perSecond: 1 / 2.5 });
  });
});

describe("character test: a bone's pose from the gaits", () => {
  /** A rotation about x by `angle`, as stored (x, y, z, w). */
  const about = (angle: number) => [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];

  it("moves through a gait's frames as the phase goes round", () => {
    // A position track over 4 frames, 0 → 8 → 0 → 8 → 0.
    const track = new Float32Array([0, 0, 0, 8, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0]);
    const out = [0, 0, 0, 0];
    const at = (phase: number) => (blendTrack([track], 3, [1], phase, out), out[0]);
    expect(at(0)).toBe(0);
    expect(at(0.125)).toBeCloseTo(4);
    expect(at(0.25)).toBeCloseTo(8);
    expect(at(0.5)).toBeCloseTo(0);
    expect(at(0.999)).toBeCloseTo(0, 1);
  });

  it("mixes the gaits by weight, reading each at the same point of its own loop", () => {
    const slow = new Float32Array([0, 0, 0, 10, 0, 0]);
    const fast = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0]);
    const out = [0, 0, 0, 0];
    expect(blendTrack([slow, fast], 3, [0.5, 0.5], 0.5, out)).toBe(true);
    expect(out[0]).toBeCloseTo((5 + 10) / 2);
    // Gaits without weight, or without this bone, aren't read.
    expect(blendTrack([slow, undefined], 3, [0, 1], 0.5, out)).toBe(false);
  });

  it("blends rotations the short way round, and keeps them unit length", () => {
    const a = new Float32Array([...about(0), ...about(0)]);
    // The same turn as about(1), written as its negative.
    const b = new Float32Array([...about(1).map((v) => -v), ...about(1).map((v) => -v)]);
    const out = [0, 0, 0, 0];
    blendTrack([a, b], 4, [0.5, 0.5], 0, out);
    expect(Math.hypot(out[0], out[1], out[2], out[3])).toBeCloseTo(1);
    // Halfway between no turn and a turn of 1 is a turn of about 0.5 (not one most of the way round).
    expect(2 * Math.atan2(Math.abs(out[0]), Math.abs(out[3]))).toBeCloseTo(0.5, 2);
  });
});
