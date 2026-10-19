import { describe, expect, it } from "vitest";
import { FixedStepper } from "../src/game/fixedStepper";

describe("FixedStepper", () => {
  it("runs whole ticks and returns the leftover as a blend factor", () => {
    const stepper = new FixedStepper(1 / 60);
    let ticks = 0;
    const alpha = stepper.advance(2.5 / 60, () => ticks++);
    expect(ticks).toBe(2);
    expect(alpha).toBeCloseTo(0.5, 6);
  });

  it("is independent of the frame rate", () => {
    const run = (fps: number) => {
      const stepper = new FixedStepper(1 / 60);
      let ticks = 0;
      for (let i = 0; i < fps * 10; i++) stepper.advance(1 / fps, () => ticks++);
      return ticks;
    };
    expect(Math.abs(run(30) - 600)).toBeLessThanOrEqual(1);
    expect(Math.abs(run(144) - 600)).toBeLessThanOrEqual(1);
  });

  it("drops the backlog after a long pause instead of fast-forwarding", () => {
    const stepper = new FixedStepper(1 / 60, 5);
    let ticks = 0;
    stepper.advance(10, () => ticks++);
    expect(ticks).toBe(5);
    ticks = 0;
    stepper.advance(1 / 60, () => ticks++);
    expect(ticks).toBe(1);
  });
});
