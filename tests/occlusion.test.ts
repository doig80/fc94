import { describe, expect, it } from "vitest";
import { boxesHidingPlay, segmentHitsBox, type Box, type CameraView } from "../src/render/occlusion";

// The 5-a-side arena: play area ±23 × ±15.5, roofs about 10.4–11.1 m up over the stands.
const HALF_X = 23;
const HALF_Z = 15.5;
const ROOFS: Record<string, Box> = {
  near: { min: { x: -25.5, y: 10.3, z: -24.9 }, max: { x: 25.5, y: 11.1, z: -14 } },
  far: { min: { x: -25.5, y: 10.3, z: 14 }, max: { x: 25.5, y: 11.1, z: 24.9 } },
  left: { min: { x: -32.4, y: 10.3, z: -18 }, max: { x: -21.5, y: 11.1, z: 18 } },
  right: { min: { x: 21.5, y: 10.3, z: -18 }, max: { x: 32.4, y: 11.1, z: 18 } },
};

/** The classic camera: 18.6 m from its target, high and diagonal from the near-left. */
function classicView(tx: number, tz: number): CameraView {
  return {
    eye: { x: tx - 9.5, y: 11.3, z: tz - 11.3 },
    target: { x: tx, y: 0, z: tz },
    fov: 0.75,
    aspect: 16 / 9,
  };
}

function hiding(view: CameraView): string[] {
  const names = Object.keys(ROOFS);
  const hidden = boxesHidingPlay(view, Object.values(ROOFS), HALF_X, HALF_Z);
  return names.filter((_, i) => hidden[i]);
}

describe("roofs in the way of the camera", () => {
  it("leaves every roof solid when play is in the middle", () => {
    expect(hiding(classicView(0, 0))).toEqual([]);
  });

  it("fades the near roof when play is at the bottom of the screen", () => {
    expect(hiding(classicView(0, -8.75))).toContain("near");
  });

  it("fades the near and left roofs in the bottom-left corner", () => {
    const hidden = hiding(classicView(-17, -8.75));
    expect(hidden).toContain("near");
    expect(hidden).toContain("left");
    expect(hidden).not.toContain("far");
    expect(hidden).not.toContain("right");
  });

  it("never fades the far roofs, which only hide the sky", () => {
    for (const [tx, tz] of [
      [17, 8.75],
      [17, -8.75],
      [-17, 8.75],
      [0, 8.75],
    ]) {
      const hidden = hiding(classicView(tx, tz));
      expect(hidden).not.toContain("far");
      expect(hidden).not.toContain("right");
    }
  });
});

describe("segmentHitsBox", () => {
  const box: Box = { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } };
  it("hits a box on the way", () => {
    expect(segmentHitsBox({ x: -5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 10, box)).toBe(true);
  });
  it("stops short of a box beyond the end of the segment", () => {
    expect(segmentHitsBox({ x: -5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 3, box)).toBe(false);
  });
  it("misses a box behind the start", () => {
    expect(segmentHitsBox({ x: 5, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 10, box)).toBe(false);
  });
  it("counts a start inside the box", () => {
    expect(segmentHitsBox({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }, 10, box)).toBe(true);
  });
});
