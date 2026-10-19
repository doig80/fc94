import {
  DEFAULT_PARAMS,
  cloneParams,
  createMatch,
  PITCH_5_A_SIDE,
  step,
  type MatchState,
  type SimParams,
} from "../src/sim";
import type { Intent } from "../src/sim/intent";

export function newMatch(seed = 1): MatchState {
  return createMatch({ seed, pitch: PITCH_5_A_SIDE, teamSize: 5 });
}

export function params(): SimParams {
  return cloneParams(DEFAULT_PARAMS);
}

/** Run `ticks` ticks with no player input. */
export function run(
  state: MatchState,
  ticks: number,
  p: SimParams = DEFAULT_PARAMS,
  intents: Intent[] = [],
): void {
  for (let i = 0; i < ticks; i++) step(state, intents, p);
}

/** A match with every player moved far from the centre, so the ball can fly freely. */
export function emptyPitch(seed = 1): MatchState {
  const s = newMatch(seed);
  s.players.forEach((pl, i) => {
    pl.pos = { x: -18 + i * 0.9, z: 14 };
  });
  return s;
}
