import type { Intent } from "./intent";
import type { SimParams } from "./params";
import { stepBall } from "./physics/ball";
import { stepDribble, updatePossession } from "./physics/dribble";
import { stepPlayers } from "./physics/players";
import type { MatchState } from "./state";

/** The simulation runs at a fixed 60 ticks per second (docs/specs/01 §3). */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/**
 * Advance the match by one tick. Mutates `state` in place; use `cloneState` for snapshots.
 * `intents[i]` is what player i wants this tick (missing = idle).
 */
export function step(state: MatchState, intents: readonly Intent[], params: SimParams): void {
  stepPlayers(state, intents, params, DT);
  updatePossession(state, params);
  if (state.ball.owner >= 0) {
    stepDribble(state, params, !!intents[state.ball.owner]?.sprint, DT);
  } else {
    stepBall(state, params, DT);
  }
  state.tick++;
}
