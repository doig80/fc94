import type { SimParams } from "./params";
import { attackSign, type MatchState } from "./state";

/**
 * Offside (docs/specs/10 §6). A player is in an offside position when they are in the opponents' half and
 * nearer the goal than both the ball and the second-last opponent (the keeper counts). Being there is fine;
 * it's offside if they're the next to touch a ball a teammate played while they were there.
 */

/**
 * The offside line for `team`, in that team's attacking frame (+ is towards the goal it attacks): the second-last
 * opponent or the ball, whichever is further forward, and never short of halfway.
 */
export function offsideLine(state: MatchState, team: 0 | 1): number {
  const s = attackSign(state, team);
  let last = -Infinity;
  let secondLast = -Infinity;
  for (const p of state.players) {
    if (p.team === team || p.sentOff) continue;
    const x = p.pos.x * s;
    if (x > last) {
      secondLast = last;
      last = x;
    } else if (x > secondLast) secondLast = x;
  }
  const ball = state.ball.pos.x * s;
  return secondLast > ball ? (secondLast > 0 ? secondLast : 0) : ball > 0 ? ball : 0;
}

/** Is player `i` in an offside position right now? */
export function inOffsidePosition(state: MatchState, i: number, params: SimParams): boolean {
  const pl = state.players[i];
  return pl.pos.x * attackSign(state, pl.team) > offsideLine(state, pl.team) + params.referee.offsideMargin;
}

/** Does the match play offside? */
export function offsideOn(state: MatchState): boolean {
  return state.rules?.offside ?? false;
}
