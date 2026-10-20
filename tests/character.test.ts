import { describe, expect, it } from "vitest";
import { blendGaits } from "../src/render/character";

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
    expect(blendGaits(GAITS, 5.36).rate).toBeCloseTo(1 / 0.933);
    // Faster than the sprint was made for: the same stride, cycled faster.
    expect(blendGaits(GAITS, 9).rate).toBeCloseTo(9 / (8.25 * 0.667));
    // Standing: the idle breathes at its own pace.
    expect(blendGaits(GAITS, 0).rate).toBeCloseTo(1 / 2.5);
  });
});
