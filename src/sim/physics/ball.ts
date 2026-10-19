import type { BallParams, SimParams } from "../params";
import type { BallState, MatchState } from "../state";
import { cross3 } from "../vec";
import { collideGoals } from "./goal";

/** Advance a loose ball by dt: gravity, drag, curve, bounces, rolling, goal frame. */
export function stepBall(state: MatchState, params: SimParams, dt: number): void {
  const ball = state.ball;
  const p = params.ball;
  const onGround = ball.pos.y <= p.radius + 1e-6 && Math.abs(ball.vel.y) < 1e-6;

  if (onGround) {
    rollingFriction(state, params, dt);
    const keep = 1 - p.groundSpinDecay * dt;
    scaleSpin(state, keep > 0 ? keep : 0);
  } else {
    const v = ball.vel;
    const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const curve = cross3(ball.spin, v);
    v.x += (curve.x * p.magnus - v.x * speed * p.airDrag) * dt;
    v.y += (curve.y * p.magnus - v.y * speed * p.airDrag - p.gravity) * dt;
    v.z += (curve.z * p.magnus - v.z * speed * p.airDrag) * dt;
    const keep = 1 - p.spinDecay * dt;
    scaleSpin(state, keep > 0 ? keep : 0);
  }

  // Move in short hops: a full-power shot travels about half a metre per tick, enough to skip clean past a
  // post, the crossbar or the net if they were only checked once per tick.
  const vel = ball.vel;
  const travel = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z) * dt;
  const hops = travel > MAX_HOP ? Math.ceil(travel / MAX_HOP) : 1;
  const h = dt / hops;
  for (let i = 0; i < hops; i++) {
    const prev = { ...ball.pos };
    ball.pos.x += ball.vel.x * h;
    ball.pos.y += ball.vel.y * h;
    ball.pos.z += ball.vel.z * h;
    bounceOffGround(ball, p);
    collideGoals(ball, prev, state.pitch, p);
  }
}

/** Longest distance the ball moves between collision checks: well under the thinnest obstacle (the net). */
const MAX_HOP = 0.08;

function bounceOffGround(ball: BallState, p: BallParams): void {
  if (ball.pos.y >= p.radius) return;
  ball.pos.y = p.radius;
  if (ball.vel.y >= 0) return;
  const up = -ball.vel.y * p.restitution;
  if (up < p.rollThreshold) {
    ball.vel.y = 0;
  } else {
    ball.vel.y = up;
    ball.vel.x *= p.bounceFriction;
    ball.vel.z *= p.bounceFriction;
  }
}

function rollingFriction(state: MatchState, params: SimParams, dt: number): void {
  const v = state.ball.vel;
  const speed = Math.sqrt(v.x * v.x + v.z * v.z);
  if (speed < 1e-6) {
    v.x = v.z = 0;
    return;
  }
  const w = params.weather;
  const factor =
    state.weather === "rain" ? w.rainRollingFactor : state.weather === "snow" ? w.snowRollingFactor : 1;
  const decel = params.ball.rollingDecel * factor + params.ball.rollingDamping * speed;
  const next = speed - decel * dt;
  const k = next > 0 ? next / speed : 0;
  v.x *= k;
  v.z *= k;
}

function scaleSpin(state: MatchState, k: number): void {
  state.ball.spin.x *= k;
  state.ball.spin.y *= k;
  state.ball.spin.z *= k;
}
