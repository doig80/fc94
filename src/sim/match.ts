import { applyActions, pass, playQueued, tickActions } from "./actions";
import { updateControl } from "./control";
import { IDLE, type Intent } from "./intent";
import type { SimParams } from "./params";
import { applyAftertouch } from "./physics/ball";
import { attackSign, type MatchState } from "./state";
import { holdDeadBall, holdRestart, holdShootout, pauseTick, referee } from "./rules";
import { DT, step } from "./step";

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
  if (state.rules && pauseTick(state)) {
    state.tick++;
    return;
  }
  updateControl(state, humanIntents, params);

  const intents: Intent[] = aiIntents ? aiIntents(state) : state.players.map(() => ({ ...IDLE }));
  state.controllers.forEach((c, k) => {
    const intent = { ...(humanIntents[k] ?? IDLE) };
    if (c.assists.autoSprint && !intent.sprint) intent.sprint = openGround(state, c.player, intent);
    intents[c.player] = intent;
  });
  oneTwoRun(state, intents);
  holdRestart(state, intents, params);
  holdShootout(state, intents);

  const assistsFor = (i: number) => state.controllers.find((c) => c.player === i)?.assists ?? null;
  applyActions(state, intents, params, assistsFor);
  tickActions(state, params);
  applyAftertouch(state, humanIntents, params, DT);
  step(state, intents, params);
  holdDeadBall(state, params);
  playQueued(state, params, assistsFor);
  oneTwoReturn(state, params);
  referee(state, params);
}

/**
 * Auto-sprint assist (docs/specs/11 §3): sprint when running hard into open ground, with stamina to spare.
 */
function openGround(state: MatchState, i: number, intent: Intent): boolean {
  const pl = state.players[i];
  const mag = Math.sqrt(intent.moveX * intent.moveX + intent.moveZ * intent.moveZ);
  if (mag < 0.7 || pl.stamina < 0.35) return false;
  const dx = intent.moveX / mag;
  const dz = intent.moveZ / mag;
  return !state.players.some((o) => {
    if (o.team === pl.team) return false;
    const ox = o.pos.x - pl.pos.x;
    const oz = o.pos.z - pl.pos.z;
    const along = ox * dx + oz * dz;
    return along > 0 && along < 5 && Math.abs(ox * dz - oz * dx) < 2;
  });
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
