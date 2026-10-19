import { describe, expect, it } from "vitest";
import { isInGoal, kickBall } from "../src/sim";
import { emptyPitch, params, run } from "./helpers";

const R = params().ball.radius;

describe("goal frame", () => {
  it("lets a shot into the goal and the net stops it", () => {
    const s = emptyPitch();
    const halfL = s.pitch.length / 2;
    s.ball.pos = { x: halfL - 6, y: 0.8, z: 0 };
    kickBall(s, -1, { x: 25, y: 1, z: 0 });
    run(s, 120);
    expect(isInGoal(s.ball, s.pitch, R)).toBe(1);
    expect(s.ball.pos.x).toBeLessThanOrEqual(halfL + s.pitch.goalDepth);
    expect(Math.hypot(s.ball.vel.x, s.ball.vel.y, s.ball.vel.z)).toBeLessThan(3);
  });

  it("bounces off the post", () => {
    const s = emptyPitch();
    const halfL = s.pitch.length / 2;
    const postZ = s.pitch.goalWidth / 2;
    s.ball.pos = { x: halfL - 5, y: 0.5, z: postZ };
    kickBall(s, -1, { x: 20, y: 0, z: 0 });
    run(s, 40);
    expect(s.ball.vel.x).toBeLessThan(0);
    expect(isInGoal(s.ball, s.pitch, R)).toBe(0);
  });

  it("bounces off the crossbar", () => {
    const s = emptyPitch();
    const halfL = s.pitch.length / 2;
    // Close to the bar, so gravity barely moves the ball before impact.
    s.ball.pos = { x: halfL - 1, y: s.pitch.goalHeight + 0.02, z: 0 };
    kickBall(s, -1, { x: 20, y: 0, z: 0 });
    run(s, 10);
    expect(s.ball.vel.x).toBeLessThan(0);
  });

  it("does not count a ball over the bar", () => {
    const s = emptyPitch();
    const halfL = s.pitch.length / 2;
    s.ball.pos = { x: halfL - 6, y: 3.5, z: 0 };
    kickBall(s, -1, { x: 25, y: 2, z: 0 });
    run(s, 60);
    expect(isInGoal(s.ball, s.pitch, R)).toBe(0);
    expect(s.ball.pos.x).toBeGreaterThan(halfL + s.pitch.goalDepth);
  });

  it("stops a wide shot on the outside of the side netting", () => {
    const s = emptyPitch();
    const halfL = s.pitch.length / 2;
    const hw = s.pitch.goalWidth / 2;
    s.ball.pos = { x: halfL + 0.6, y: 0.5, z: hw + 3 };
    kickBall(s, -1, { x: 0, y: 0, z: -15 });
    run(s, 60);
    expect(s.ball.pos.z).toBeGreaterThanOrEqual(hw + R - 1e-9);
    expect(isInGoal(s.ball, s.pitch, R)).toBe(0);
  });
});

// A full-power shot moves about half a metre per tick, more than the width of a post.
describe("goal frame at full shot speed", () => {
  const FULL = 31;

  it("hits the post instead of passing through it", () => {
    const halfL = emptyPitch().pitch.length / 2;
    const postZ = emptyPitch().pitch.goalWidth / 2;
    // Aim across the whole width of the post, as drawn.
    for (const offset of [-0.2, -0.1, 0, 0.1, 0.2]) {
      for (const startX of [8, 8.13, 8.26, 8.39]) {
        const s = emptyPitch();
        s.ball.pos = { x: halfL - startX, y: 0.5, z: postZ + offset };
        kickBall(s, -1, { x: FULL, y: 0, z: 0 });
        run(s, 60);
        const deflected = s.ball.vel.x < FULL * 0.5 || Math.abs(s.ball.pos.z - (postZ + offset)) > 0.3;
        expect(deflected, `offset ${offset}, start ${startX}`).toBe(true);
      }
    }
  });

  it("hits the crossbar instead of passing through it", () => {
    for (const startX of [3, 3.13, 3.26, 3.39]) {
      const s = emptyPitch();
      const halfL = s.pitch.length / 2;
      s.ball.pos = { x: halfL - startX, y: s.pitch.goalHeight, z: 0 };
      kickBall(s, -1, { x: FULL, y: 0, z: 0 });
      run(s, 30);
      expect(s.ball.vel.x, `start ${startX}`).toBeLessThan(0);
    }
  });

  it("keeps a full-power shot inside the net", () => {
    for (const startX of [6, 6.13, 6.26, 6.39]) {
      const s = emptyPitch();
      const halfL = s.pitch.length / 2;
      s.ball.pos = { x: halfL - startX, y: 0.8, z: 0.5 };
      kickBall(s, -1, { x: FULL, y: 1, z: 0 });
      run(s, 120);
      expect(isInGoal(s.ball, s.pitch, R), `start ${startX}`).toBe(1);
    }
  });

  it("keeps a fast wide ball outside the side netting", () => {
    for (const startZ of [3, 3.13, 3.26, 3.39]) {
      const s = emptyPitch();
      const halfL = s.pitch.length / 2;
      const hw = s.pitch.goalWidth / 2;
      s.ball.pos = { x: halfL + 0.6, y: 0.5, z: hw + startZ };
      kickBall(s, -1, { x: 0, y: 0, z: -FULL });
      run(s, 60);
      expect(s.ball.pos.z, `start ${startZ}`).toBeGreaterThanOrEqual(hw + R - 1e-9);
    }
  });
});
