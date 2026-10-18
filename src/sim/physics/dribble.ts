import { DEFAULT_PARAMS, type SimParams } from "../params";
import type { MatchState } from "../state";
import type { Vec3 } from "../vec";

/**
 * Ball control: a nearby player picks up a loose, low, slow-enough ball, and keeps it just ahead of
 * their feet while dribbling. Taking the ball off a dribbling opponent is a tackle (docs/specs/10 §3).
 */
export function updatePossession(state: MatchState, params: SimParams): void {
  const ball = state.ball;
  const d = params.dribble;
  if (ball.owner >= 0) {
    const owner = state.players[ball.owner];
    const dx = ball.pos.x - owner.pos.x;
    const dz = ball.pos.z - owner.pos.z;
    if (dx * dx + dz * dz > d.loseDistance * d.loseDistance || ball.pos.y > d.controlMaxHeight)
      ball.owner = -1;
    return;
  }
  if (ball.pos.y > d.controlMaxHeight) return;

  let best = -1;
  let bestDistSq = d.controlRadius * d.controlRadius;
  state.players.forEach((pl, i) => {
    if (i === ball.lastTouch && state.tick < ball.touchBlockUntil) return;
    if (pl.action.kind === "slide" || pl.action.kind === "stumble") return;
    const dx = ball.pos.x - pl.pos.x;
    const dz = ball.pos.z - pl.pos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq >= bestDistSq) return;
    const rvx = ball.vel.x - pl.vel.x;
    const rvz = ball.vel.z - pl.vel.z;
    // The intended receiver of a pass always controls it; anyone else only a slow-enough ball.
    const maxRel = i === ball.intendedReceiver ? d.controlMaxRelSpeed * 2 : d.controlMaxRelSpeed;
    if (rvx * rvx + rvz * rvz > maxRel * maxRel) return;
    best = i;
    bestDistSq = distSq;
  });
  if (best >= 0) {
    ball.owner = best;
    ball.lastTouch = best;
    ball.intendedReceiver = -1;
  }
}

/** Steer an owned ball towards the spot just ahead of the owner's feet. */
export function stepDribble(state: MatchState, params: SimParams, sprinting: boolean, dt: number): void {
  const ball = state.ball;
  const owner = state.players[ball.owner];
  const d = params.dribble;
  const reach = sprinting ? d.sprintDistance : d.distance;
  const tx = owner.pos.x + owner.facing.x * reach;
  const tz = owner.pos.z + owner.facing.z * reach;
  ball.vel.x = owner.vel.x + (tx - ball.pos.x) * d.stiffness;
  ball.vel.z = owner.vel.z + (tz - ball.pos.z) * d.stiffness;
  ball.vel.y = 0;
  ball.pos.x += ball.vel.x * dt;
  ball.pos.z += ball.vel.z * dt;
  ball.pos.y = params.ball.radius;
  ball.spin.x = ball.spin.y = ball.spin.z = 0;
}

export interface KickOptions {
  /** Ticks before the kicker may touch the ball again. */
  blockTicks?: number;
  /** The teammate the ball is meant for (passes). */
  receiver?: number;
}

/** Release the ball from `kicker` with the given velocity and spin (passes, shots, clearances, tackles). */
export function kickBall(
  state: MatchState,
  kicker: number,
  vel: Vec3,
  spin: Vec3 = { x: 0, y: 0, z: 0 },
  options: KickOptions = {},
): void {
  const ball = state.ball;
  ball.owner = -1;
  ball.lastTouch = kicker;
  ball.touchBlockUntil = state.tick + (options.blockTicks ?? DEFAULT_PARAMS.dribble.kickCooldownTicks);
  ball.intendedReceiver = options.receiver ?? -1;
  ball.vel = { ...vel };
  ball.spin = { ...spin };
}
