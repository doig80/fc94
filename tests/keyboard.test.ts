import { describe, expect, it } from "vitest";
import { screenToPitch } from "../src/input/keyboard";

describe("screen-relative controls", () => {
  it("broadcast camera (looking along +z): up is +z, right is +x", () => {
    const yaw = Math.PI / 2;
    const up = screenToPitch(0, 1, yaw);
    const right = screenToPitch(1, 0, yaw);
    expect(up.x).toBeCloseTo(0);
    expect(up.z).toBeCloseTo(1);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it("classic diagonal camera: up heads diagonally towards the attacked goal", () => {
    const yaw = -Math.PI / 2 - 0.7 + Math.PI;
    const up = screenToPitch(0, 1, yaw);
    expect(up.x).toBeGreaterThan(0.5);
    expect(up.z).toBeGreaterThan(0.5);
  });

  it("keeps unit length for straight inputs", () => {
    const v = screenToPitch(1, 0, 0.37);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
  });
});
