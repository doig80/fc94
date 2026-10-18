import { applyActions, attackSign, pass, playQueued, tickActions } from "./actions";
import { updateControl } from "./control";
import { IDLE, type Intent } from "./intent";
import type { SimParams } from "./params";
import type { MatchState } from "./state";
import { step } from "./step";

/**
 * One tick of a match: humans' intents go to the players they control, everyone else gets an AI intent
 * (idle until the AI exists, docs/specs/30 §1), buttons become actions, then physics runs.
 * `humanIntents[k]` belongs to `state.controllers[k]`.
 */
export function stepMatch(
  state: MatchState,
  humanIntents: readonly Intent[],
  params: SimParams,
  aiIntents?: (state: MatchState) => Intent[],
): void {
  updateControl(state, humanIntents, params);

  const intents: Intent[] = aiIntents ? aiIntents(state) : state.players.map(() => ({ ...IDLE }));
  state.controllers.forEach((c, k) => {
    intents[c.player] = humanIntents[k] ?? { ...IDLE };
  });
  oneTwoRun(state, intents);

  const assistsFor = (i: number) => state.controllers.find((c) => c.player === i)?.assists ?? null;
  applyActions(state, intents, params, assistsFor);
  tickActions(state, params);
  step(state, intents, params);
  playQueued(state, params, assistsFor);
  oneTwoReturn(state, params);
}

/** During a one-two the passer sprints on towards the goal. */
function oneTwoRun(state: MatchState, intents: Intent[]): void {
  const o = state.oneTwo;
  if (!o) return;
  if (state.tick > o.until) {
    state.oneTwo = null;
    return;
  }
  if (state.controllers.some((c) => c.player === o.passer)) return;
  const s = attackSign(state, state.players[o.passer].team);
  intents[o.passer] = { ...IDLE, moveX: s, moveZ: 0, sprint: true };
}

/** When the one-two receiver gets the ball, it goes straight back into the passer's run. */
function oneTwoReturn(state: MatchState, params: SimParams): void {
  const o = state.oneTwo;
  if (!o || state.ball.owner !== o.receiver) return;
  const passer = state.players[o.passer];
  const r = state.players[o.receiver];
  const dir = { x: passer.pos.x - r.pos.x, z: passer.pos.z - r.pos.z };
  pass(state, o.receiver, dir, params, null, true);
  state.oneTwo = null;
}
