import { describe, expect, it } from "vitest";
import { combine, DEADZONE, GamepadInput, PAD, padIntent, type PadState } from "../src/input/gamepad";
import { screenToPitch } from "../src/input/keyboard";
import { IDLE } from "../src/sim";

/** A standard pad at rest, with `held` buttons down and the left stick at (lx, ly) (y points down). */
function pad(held: number[] = [], lx = 0, ly = 0): PadState {
  return {
    axes: [lx, ly, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: held.includes(i),
      value: held.includes(i) ? 1 : 0,
    })),
  };
}

const YAW = Math.PI / 2; // broadcast camera: screen up is +z, right is +x

describe("gamepad controls (docs/specs/10 §3)", () => {
  it("A passes, B shoots, X lobs, RT sprints", () => {
    expect(padIntent(pad([PAD.a]), YAW)).toMatchObject({
      pass: true,
      shoot: false,
      lob: false,
      sprint: false,
    });
    expect(padIntent(pad([PAD.b]), YAW)).toMatchObject({ pass: false, shoot: true, lob: false });
    expect(padIntent(pad([PAD.x]), YAW)).toMatchObject({ pass: false, shoot: false, lob: true });
    expect(padIntent(pad([PAD.rt]), YAW).sprint).toBe(true);
    // An analogue trigger counts once it's pulled a little way; RB works too, for pads without triggers.
    const trigger = pad();
    (trigger.buttons as { pressed: boolean; value: number }[])[PAD.rt] = { pressed: false, value: 0.4 };
    expect(padIntent(trigger, YAW).sprint).toBe(true);
    expect(padIntent(pad([PAD.rb]), YAW).sprint).toBe(true);
    expect(padIntent(pad(), YAW)).toEqual({ ...IDLE });
  });

  it("the left stick runs the way it points on screen, like the keyboard", () => {
    const right = padIntent(pad([], 1, 0), YAW);
    const want = screenToPitch(1, 0, YAW);
    expect(right.moveX).toBeCloseTo(want.x);
    expect(right.moveZ).toBeCloseTo(want.z);
    // Stick up is negative y.
    const up = padIntent(pad([], 0, -1), YAW);
    expect(up.moveZ).toBeCloseTo(1);
  });

  it("is analogue: a small tilt is ignored, a half tilt jogs, any angle is exact", () => {
    expect(padIntent(pad([], DEADZONE * 0.8, 0), YAW)).toMatchObject({ moveX: 0, moveZ: 0 });
    const half = padIntent(pad([], 0.6, 0), YAW);
    expect(Math.hypot(half.moveX, half.moveZ)).toBeGreaterThan(0.3);
    expect(Math.hypot(half.moveX, half.moveZ)).toBeLessThan(0.7);
    const full = padIntent(pad([], 0.97, 0), YAW);
    expect(Math.hypot(full.moveX, full.moveZ)).toBeCloseTo(1, 1);
    // 20° off the axis stays 20° off it: finer than the keyboard's eight directions.
    const angle = (20 * Math.PI) / 180;
    const aimed = padIntent(pad([], Math.cos(angle), -Math.sin(angle)), YAW);
    expect(Math.atan2(aimed.moveZ, aimed.moveX)).toBeCloseTo(angle, 3);
  });

  it("the d-pad runs too", () => {
    const right = padIntent(pad([PAD.right]), YAW);
    expect(right.moveX).toBeCloseTo(1);
    const upLeft = padIntent(pad([PAD.up, PAD.left]), YAW);
    expect(upLeft.moveX).toBeLessThan(0);
    expect(upLeft.moveZ).toBeGreaterThan(0);
  });

  it("works alongside the keyboard: the one pushed further steers, any button counts", () => {
    const keys = { ...IDLE, moveX: 1, shoot: true };
    const stick = { ...IDLE, moveZ: 0.3, sprint: true };
    expect(combine(keys, stick)).toEqual({ ...IDLE, moveX: 1, moveZ: 0, shoot: true, sprint: true });
    expect(combine({ ...IDLE }, stick).moveZ).toBe(0.3);
  });

  it("plugs in and out at any time, and reports presses once (Start to pause)", () => {
    let pads: (PadState | null)[] = [];
    const input = new GamepadInput(() => pads);
    expect(input.connected()).toBe(false);
    expect(input.read(YAW)).toBeNull();
    pads = [null, pad([PAD.start])];
    expect(input.connected()).toBe(true);
    expect(input.pressed().has(PAD.start)).toBe(true);
    expect(input.pressed().has(PAD.start)).toBe(false); // still held: not a new press
    pads = [null, pad()];
    expect(input.pressed().size).toBe(0);
    pads = [null, pad([PAD.start])];
    expect(input.pressed().has(PAD.start)).toBe(true);
    pads = [];
    expect(input.read(YAW)).toBeNull();
  });
});
