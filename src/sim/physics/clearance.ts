import type { SimParams } from "../params";
import type { MatchState } from "../state";
import { kickBall } from "./dribble";
import { inOwnBox } from "./keeper";

/**
 * Defenders head a high ball out of their own area (docs/specs/11 §4): an outfield player who gets within
 * `clearReach` of a cross or lob meant for an opponent, at volley-to-header height, in the area they defend, knocks
 * it up and away towards the wing it came from. Automatic, like a keeper's hands; an attacker's answer is to get
 * there first. Shots and loose balls are left alone.
 */
export function clearances(state: MatchState, params: SimParams): void {
  const ball = state.ball;
  const a = params.action;
  const d = params.dribble;
  if (ball.owner >= 0 || ball.intendedReceiver < 0) return;
  if (ball.pos.y < a.volleyMinHeight || ball.pos.y > a.headerMaxHeight) return;
  const from = state.players[ball.intendedReceiver].team;
  for (let i = 0; i < state.players.length; i++) {
    const pl = state.players[i];
    if (pl.team === from || pl.role === "gk" || pl.sentOff || pl.action.kind !== "none") continue;
    if (!inOwnBox(state, pl.team, ball.pos.x, ball.pos.z)) continue;
    const dx = ball.pos.x - pl.pos.x;
    const dz = ball.pos.z - pl.pos.z;
    if (dx * dx + dz * dz > d.clearReach * d.clearReach) continue;
    // Away from goal and out to the wing: (1, 0.6) normalised.
    const dir = { x: (ball.pos.x > 0 ? -1 : 1) / 1.1662, z: (ball.pos.z >= 0 ? 0.6 : -0.6) / 1.1662 };
    kickBall(state, i, { x: dir.x * d.clearSpeed, y: d.clearLift, z: dir.z * d.clearSpeed });
    const kind = ball.pos.y >= a.headerMinHeight ? "header" : "volley";
    pl.action = { kind, ticks: 20, total: 20, dir };
    return;
  }
}
