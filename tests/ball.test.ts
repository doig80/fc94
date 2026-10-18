import { describe, expect, it } from "vitest";
import { kickBall, type MatchState } from "../src/sim";
import { emptyPitch, params, run } from "./helpers";

function dropBall(s: MatchState, height: number): void {
  s.ball.pos = { x: 0, y: height, z: 0 };
  s.ball.vel = { x: 0, y: 0, z: 0 };
}

function rollDistance(weather: MatchState["weather"]): number {
  const s = emptyPitch();
  s.weather = weather;
  kickBall(s, -1, { x: 8, y: 0, z: 0 });
  run(s, 600);
  return s.ball.pos.x;
}

describe("ball physics", () => {
  it("falls under gravity and lands at the expected time", () => {
    const s = emptyPitch();
    const p = params();
    p.ball.airDrag = 0;
    dropBall(s, 5);
    let ticks = 0;
    while (s.ball.vel.y <= 0 && ticks < 200) {
      run(s, 1, p);
      ticks++;
    }
    const expected = Math.sqrt((2 * (5 - p.ball.radius)) / p.ball.gravity) * 60;
    expect(Math.abs(ticks - expected)).toBeLessThan(3);
  });

  it("bounces lower each time and settles into rolling", () => {
    const s = emptyPitch();
    dropBall(s, 4);
    const peaks: number[] = [];
    let wasRising = false;
    for (let i = 0; i < 600; i++) {
      run(s, 1);
      const rising = s.ball.vel.y > 0;
      if (wasRising && !rising) peaks.push(s.ball.pos.y);
      wasRising = rising;
    }
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    expect(peaks[1]).toBeLessThan(peaks[0]);
    expect(s.ball.vel.y).toBe(0);
    expect(s.ball.pos.y).toBeCloseTo(params().ball.radius);
  });

  it("rolls to a stop", () => {
    const s = emptyPitch();
    kickBall(s, -1, { x: 10, y: 0, z: 0 });
    run(s, 900);
    expect(s.ball.vel.x).toBe(0);
    expect(s.ball.pos.x).toBeGreaterThan(5);
  });

  it("skids further in rain and stops sooner in snow", () => {
    const clear = rollDistance("clear");
    expect(rollDistance("rain")).toBeGreaterThan(clear * 1.1);
    expect(rollDistance("snow")).toBeLessThan(clear * 0.9);
  });

  it("slows down in the air because of drag", () => {
    const s = emptyPitch();
    s.ball.pos = { x: -15, y: 10, z: 0 };
    kickBall(s, -1, { x: 30, y: 0, z: 0 });
    run(s, 20);
    expect(s.ball.vel.x).toBeLessThan(30);
  });

  it("curls sideways with spin (spin around +y bends a ball moving +x towards -z)", () => {
    const s = emptyPitch();
    s.ball.pos = { x: -15, y: 0.5, z: 0 };
    kickBall(s, -1, { x: 25, y: 6, z: 0 }, { x: 0, y: 12, z: 0 });
    run(s, 40);
    expect(s.ball.pos.z).toBeLessThan(-0.5);

    const t = emptyPitch();
    t.ball.pos = { x: -15, y: 0.5, z: 0 };
    kickBall(t, -1, { x: 25, y: 6, z: 0 }, { x: 0, y: -12, z: 0 });
    run(t, 40);
    expect(t.ball.pos.z).toBeCloseTo(-s.ball.pos.z, 6);
  });

  it("never sinks into the ground", () => {
    const s = emptyPitch();
    s.ball.pos = { x: 0, y: 3, z: 0 };
    kickBall(s, -1, { x: 5, y: -30, z: 2 });
    for (let i = 0; i < 120; i++) {
      run(s, 1);
      expect(s.ball.pos.y).toBeGreaterThanOrEqual(params().ball.radius - 1e-9);
    }
  });
});
