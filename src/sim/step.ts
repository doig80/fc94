import type { Intent } from "./intent";
import type { SimParams } from "./params";
import { stepBall } from "./physics/ball";
import { clearances } from "./physics/clearance";
import { stepDribble, touchAhead, updatePossession } from "./physics/dribble";
import { keeperSaves } from "./physics/keeper";
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
  const owner = state.ball.owner;
  if (owner >= 0 && !touchAhead(state, params, !!intents[owner]?.sprint)) {
    stepDribble(state, params, !!intents[owner]?.sprint, DT);
  } else {
    clearances(state, params);
    const prev = { ...state.ball.pos };
    stepBall(state, params, DT);
    keeperSaves(state, prev, params);
  }
  state.tick++;
}
