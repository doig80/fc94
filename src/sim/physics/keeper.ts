import type { SimParams } from "../params";
import type { MatchState } from "../state";
import type { Vec3 } from "../vec";

/** +1 if `team` attacks the goal at +x in the current half, else −1 (so it defends the goal at −sign). */
function attackSign(state: MatchState, team: 0 | 1): 1 | -1 {
  return (team === 0) === (state.half === 1) ? 1 : -1;
}

/** Is (x, z) inside the penalty area of the goal that `team` defends? */
export function inOwnBox(state: MatchState, team: 0 | 1, x: number, z: number): boolean {
  const goalX = (-attackSign(state, team) * state.pitch.length) / 2;
  return (
    Math.abs(x - goalX) <= state.pitch.penaltyAreaDepth && Math.abs(z) <= state.pitch.penaltyAreaWidth / 2
  );
}

/** A keeper holding the ball in their own area can't be tackled. */
export function keeperHolds(state: MatchState): boolean {
  const owner = state.ball.owner;
  if (owner < 0) return false;
  const gk = state.players[owner];
  return gk.role === "gk" && inOwnBox(state, gk.team, gk.pos.x, gk.pos.z);
}

/**
 * Goalkeepers use their hands in their own area (docs/specs/11 §4). A ball that passes within reach this tick,
 * below `handHeight`, is caught if it's slow enough, tipped over the bar if it's high, and otherwise parried
 * wide: never back towards the middle of the goal, so standing in front of the keeper isn't a trick that works.
 * `prev` is where the ball was at the start of the tick, so fast shots can't slip past between two ticks.
 */
export function keeperSaves(state: MatchState, prev: Vec3, params: SimParams): void {
  const ball = state.ball;
  const k = params.keeper;
  for (let i = 0; i < state.players.length; i++) {
    if (ball.owner >= 0) return;
    const gk = state.players[i];
    if (gk.role !== "gk") continue;
    if (i === ball.lastTouch && state.tick < ball.touchBlockUntil) continue;
    const act = gk.action.kind;
    if (act === "recover" || act === "stumble") continue;
    if (!inOwnBox(state, gk.team, gk.pos.x, gk.pos.z)) continue;

    // Closest point of this tick's ball path to the keeper.
    const sx = ball.pos.x - prev.x;
    const sz = ball.pos.z - prev.z;
    const lenSq = sx * sx + sz * sz;
    let t = lenSq > 1e-9 ? ((gk.pos.x - prev.x) * sx + (gk.pos.z - prev.z) * sz) / lenSq : 1;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = prev.x + sx * t;
    const pz = prev.z + sz * t;
    const py = prev.y + (ball.pos.y - prev.y) * t;
    const dx = px - gk.pos.x;
    const dz = pz - gk.pos.z;
    // A dive stretches the keeper out.
    const reach = act === "dive" ? k.reach * 1.6 : k.reach;
    const offSq = dx * dx + dz * dz;
    if (offSq > reach * reach || py > k.handHeight) continue;

    const v = ball.vel;
    const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    ball.lastTouch = i;
    ball.intendedReceiver = -1;
    ball.aftertouchUntil = 0;
    ball.spin = { x: 0, y: 0, z: 0 };
    // At full stretch only softer shots can be held.
    const holdable = offSq < reach * reach * 0.5 ? k.catchSpeed : k.catchSpeed * 0.6;
    if (speed <= holdable) {
      ball.owner = i;
      ball.ownedSince = state.tick;
      ball.pos = { x: gk.pos.x + gk.facing.x * 0.4, y: params.ball.radius, z: gk.pos.z + gk.facing.z * 0.4 };
      ball.vel = { x: 0, y: 0, z: 0 };
      return;
    }
    ball.pos = { x: px, y: py > params.ball.radius ? py : params.ball.radius, z: pz };
    ball.touchBlockUntil = state.tick + 12;
    const out = attackSign(state, gk.team); // away from the keeper's own goal
    if (py > state.pitch.goalHeight - 0.45) {
      // Tipped over the bar: up and on, out behind the goal.
      v.x *= 0.5;
      v.z *= 0.5;
      v.y = (v.y > 0 ? v.y : 0) + 4.5;
    } else {
      // Parried wide, to the side the ball is on.
      const side = pz > 0.05 ? 1 : pz < -0.05 ? -1 : dz >= 0 ? 1 : -1;
      const keep = speed * k.parryKeep;
      v.x = out * keep * 0.45;
      v.z = side * keep * 0.9;
      v.y = 1.5;
    }
  }
}
