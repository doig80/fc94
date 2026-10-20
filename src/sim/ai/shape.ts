import { offsideLine, offsideOn } from "../offside";
import { attackSign, FORMATIONS, type MatchState } from "../state";
import { clamp, type Vec2 } from "../vec";

/** A player's line in the team's shape (docs/specs/11 §4), from where they line up at kick-off. */
export type Line = "keeper" | "defence" | "midfield" | "attack";

export function lineOf(state: MatchState, i: number): Line {
  const teamSize = state.players.length / 2;
  const fx = FORMATIONS[teamSize][i % teamSize][0];
  return fx <= -0.9 ? "keeper" : fx < -0.5 ? "defence" : fx < -0.2 ? "midfield" : "attack";
}

/** Full-backs and wide midfielders: the players who attack down the wings. */
export function isWide(state: MatchState, i: number): boolean {
  const teamSize = state.players.length / 2;
  return Math.abs(FORMATIONS[teamSize][i % teamSize][1]) >= 0.5;
}

/**
 * How far up the pitch each line of `team` stands, in that team's attacking frame (its own goal at −half length).
 * Out of possession the team stays compact: the back line holds a common line a little behind the ball, never
 * deeper than near its own six-yard box, and the midfield sits just in front of it. In possession everyone pushes
 * up, and the forwards play on the shoulder of the opponents' last defender.
 */
export function teamLines(state: MatchState, team: 0 | 1, attacking: boolean): Record<Line, number> {
  const halfL = state.pitch.length / 2;
  const s = attackSign(state, team);
  const ballX = state.ball.pos.x * s;
  const deepest = -halfL + state.pitch.goalAreaDepth * 1.2;
  if (!attacking) {
    const defence = clamp(Math.min(ballX * 0.6 - 0.3 * halfL, ballX - 4), deepest, 0.15 * halfL);
    const midfield = Math.min(defence + 0.22 * halfL, ballX + 2);
    return { keeper: -halfL, defence, midfield, attack: midfield + 0.2 * halfL };
  }
  const defence = clamp(ballX * 0.5 - 0.2 * halfL, -0.75 * halfL, 0.25 * halfL);
  const midfield = clamp(Math.max(defence + 0.25 * halfL, ballX - 8), defence, halfL - 14);
  // On the shoulder of the opponents' last outfield player (their offside line).
  const lastDefender = Math.max(...opponents(state, team).map((p) => p.x * s));
  const attack = clamp(Math.max(ballX + 6, lastDefender - 1), midfield, halfL - 6);
  return { keeper: -halfL, defence, midfield, attack };
}

/** Outfield players of the other team. */
function opponents(state: MatchState, team: 0 | 1): Vec2[] {
  return state.players.filter((p) => p.team !== team && p.role !== "gk" && !p.sentOff).map((p) => p.pos);
}

/** Where player `i` stands in the shape: on its line, at its width, shifted towards the ball's side. */
export function shapeSpot(state: MatchState, i: number, attacking: boolean): Vec2 {
  const pl = state.players[i];
  const teamSize = state.players.length / 2;
  const base = FORMATIONS[teamSize][i % teamSize];
  const s = attackSign(state, pl.team);
  const halfW = state.pitch.width / 2;
  const x = teamLines(state, pl.team, attacking)[lineOf(state, i)];
  // Wide in possession, narrow and ball-side out of it. Formations are written for the team attacking +x.
  const width = attacking ? 1.05 : 0.75;
  const z = clamp(base[1] * s * halfW * width + state.ball.pos.z * 0.3, -0.92 * halfW, 0.92 * halfW);
  return { x: x * s, z };
}

/**
 * `spot` for a player of `team`, held back level with the offside line when offside is on, so runs stay onside.
 * `read` is how far forward the player thinks the line is: read too far forward, the run goes offside.
 */
export function keepOnside(state: MatchState, team: 0 | 1, spot: Vec2, read = 0): Vec2 {
  if (!offsideOn(state)) return spot;
  const s = attackSign(state, team);
  const limit = offsideLine(state, team) - 0.5 + read;
  return spot.x * s > limit ? { x: limit * s, z: spot.z } : spot;
}
