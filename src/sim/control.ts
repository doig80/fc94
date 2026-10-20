import { attackingContext, bits } from "./actions";
import type { Intent } from "./intent";
import type { SimParams } from "./params";
import { Button, type Controller, type MatchState } from "./state";

/**
 * Which footballer each human controls (docs/specs/10 §4). Goalkeepers are always AI.
 * - Pass while defending switches to the teammate nearest the ball.
 * - Auto-switch (assist): follow your team's passes and the ball carrier; when defending, jump to a
 *   clearly closer teammate.
 */
export function updateControl(state: MatchState, humanIntents: readonly Intent[], params: SimParams): void {
  state.controllers.forEach((c, slot) => {
    const intent = humanIntents[slot];
    const now = bits(intent);
    const current = state.players[c.player];
    const pressed = now & ~current.held;
    const ball = state.ball;

    // Follow our own passes and our ball carrier (but never into goal: keepers are always AI).
    const receiver = ball.intendedReceiver >= 0 ? state.players[ball.intendedReceiver] : null;
    if (receiver && receiver.team === c.team) {
      if (ball.intendedReceiver !== c.player && receiver.role !== "gk") {
        switchTo(state, c, ball.intendedReceiver, now, params);
      }
      return;
    }
    if (ball.owner >= 0 && state.players[ball.owner].team === c.team) {
      if (ball.owner !== c.player && state.players[ball.owner].role !== "gk")
        switchTo(state, c, ball.owner, now, params);
      return;
    }

    const defending = !attackingContext(state, c.player, params);
    if (defending && pressed & Button.pass) {
      const next = nearestToBall(state, c.team, c.player);
      if (next >= 0) switchTo(state, c, next, now, params);
      return;
    }
    if (c.assists.autoSwitch && state.tick >= c.switchLockUntil) {
      const best = nearestToBall(state, c.team, -1);
      if (best >= 0 && best !== c.player) {
        const gain = distToBall(state, c.player) - distToBall(state, best);
        if (gain > params.action.switchHysteresis) switchTo(state, c, best, now, params);
      }
    }
  });
}

function switchTo(state: MatchState, c: Controller, next: number, held: number, params: SimParams): void {
  const old = state.players[c.player];
  old.charge = -1;
  old.lobCharge = -1;
  old.queued = null;
  c.player = next;
  // The button that caused the switch counts as already held, so it doesn't also act for the new player.
  state.players[next].held = held;
  c.switchLockUntil = state.tick + params.action.switchLockTicks;
}

/** The outfield player of `team` nearest the ball, skipping `exclude`. */
function nearestToBall(state: MatchState, team: 0 | 1, exclude: number): number {
  let best = -1;
  let bestDist = Infinity;
  state.players.forEach((p, i) => {
    if (p.team !== team || p.role === "gk" || p.sentOff || i === exclude) return;
    const d = distToBall(state, i);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

function distToBall(state: MatchState, i: number): number {
  const p = state.players[i].pos;
  const b = state.ball.pos;
  // Look slightly ahead of a moving ball.
  const dx = b.x + state.ball.vel.x * 0.3 - p.x;
  const dz = b.z + state.ball.vel.z * 0.3 - p.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** The controlled player index for each human. */
export function controlledPlayers(state: MatchState): number[] {
  return state.controllers.map((c) => c.player);
}
