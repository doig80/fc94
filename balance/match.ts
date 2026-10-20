import {
  aiIntents,
  attackSign,
  createMatch,
  inOwnBox,
  PITCH_FULL,
  TICK_RATE,
  stepMatch,
  type Intent,
  type MatchEvent,
  type MatchState,
  type SimParams,
} from "../src/sim";

/** What a balance run counts in one match (docs/specs/11 §6). */
export interface MatchStats {
  score: [number, number];
  /** Ticks each team had the ball while play was live. */
  possession: [number, number];
  shots: [number, number];
  /** Referee calls: fouls show up as advantage, free kicks and penalties. */
  calls: Partial<Record<MatchEvent["kind"], number>>;
  /** Every pass that reached its teammate: how far it was aimed (m) and how long it took to arrive (s). */
  passes: { dist: number; time: number }[];
  /** Passes played, including those that didn't arrive. */
  passesTried: number;
  /** Crosses: balls in the air from out wide in the final third to a teammate in the box. */
  crosses: number;
  /** ...that the teammate got to first. */
  crossesReached: number;
  /** Cards shown: yellow (including a second one) and red (straight or second yellow). */
  cards: { yellow: number; red: number };
}

/** The game's default match: 11 v 11 on the full pitch, 5 minutes a half (docs/specs/10 §1). */
export const PITCH = PITCH_FULL;
export const TEAM_SIZE = 11;
export const HALF_TICKS = 5 * 60 * TICK_RATE;

/** Volleys, headers and bicycle kicks are shots too (docs/specs/10 §3). */
const CONTACT_SHOTS = new Set(["volley", "header", "bicycle"]);

/**
 * A whole match with the referee, as the game plays it. `bot` scripts the `humans` (the exploit bots): it
 * returns one intent per controller every tick. Everyone else is the CPU.
 */
export function playMatch(
  seed: number,
  params: SimParams,
  options: { halfTicks?: number; humans?: (0 | 1)[]; bot?: (s: MatchState) => Intent[] } = {},
): MatchStats {
  const state = createMatch({
    seed,
    pitch: PITCH,
    teamSize: TEAM_SIZE,
    humans: options.humans ?? [],
    rules: { halfTicks: options.halfTicks ?? HALF_TICKS, fouls: true, offside: true, cards: true },
  });
  const cpu = (s: MatchState) => aiIntents(s, params);
  const watch = statsWatcher();
  while (state.phase.kind !== "fulltime") {
    stepMatch(state, options.bot ? options.bot(state) : [], params, cpu);
    watch(state);
  }
  return watch.stats;
}

/** Call after every tick to collect `MatchStats`. */
export function statsWatcher(): ((s: MatchState) => void) & { stats: MatchStats } {
  const stats: MatchStats = {
    score: [0, 0],
    possession: [0, 0],
    shots: [0, 0],
    calls: {},
    passes: [],
    passesTried: 0,
    crosses: 0,
    crossesReached: 0,
    cards: { yellow: 0, red: 0 },
  };
  let pass: { to: number; tick: number; dist: number; cross: boolean } | null = null;
  const arrived = (s: MatchState, p: NonNullable<typeof pass>) => {
    stats.passes.push({ dist: p.dist, time: (s.tick - p.tick) / TICK_RATE });
    if (p.cross) stats.crossesReached++;
  };
  /** When the ball was last kicked, as of the previous tick. */
  let kicked = -1;
  let lastCall = -1;
  /** Who was winding up a shot last tick (the shoot button held on the ball). */
  let charging: boolean[] = [];
  const watch = (s: MatchState) => {
    const b = s.ball;
    if (s.phase.kind === "play" && b.owner >= 0) stats.possession[s.players[b.owner].team]++;
    if (b.kickedAt !== kicked && b.owner < 0 && b.lastTouch >= 0) {
      // A kick this tick: a pass if it was aimed at a teammate, a shot if it's heading for goal fast. A pass
      // played on first time (or volleyed, or headed) by the player it was for arrived.
      const kicker = s.players[b.lastTouch];
      if (pass && b.lastTouch === pass.to) arrived(s, pass);
      pass = null;
      if (b.intendedReceiver >= 0) {
        const r = s.players[b.intendedReceiver];
        stats.passesTried++;
        const dist = Math.hypot(r.pos.x - kicker.pos.x, r.pos.z - kicker.pos.z);
        const cross = isCross(s, b.lastTouch, b.intendedReceiver);
        if (cross) stats.crosses++;
        pass = { to: b.intendedReceiver, tick: b.kickedAt, dist, cross };
      } else if (
        charging[b.lastTouch] ||
        // A header or volley in your own area is a clearance, not a shot.
        (CONTACT_SHOTS.has(kicker.action.kind) && !inOwnBox(s, kicker.team, kicker.pos.x, kicker.pos.z))
      ) {
        stats.shots[kicker.team]++;
      }
    } else if (pass && b.owner >= 0) {
      if (b.owner === pass.to) arrived(s, pass);
      pass = null;
    }
    kicked = b.kickedAt;
    const e = s.lastEvent;
    if (e && e.tick !== lastCall) {
      lastCall = e.tick;
      stats.calls[e.kind] = (stats.calls[e.kind] ?? 0) + 1;
      if (e.card?.red) stats.cards.red++;
      else if (e.card) stats.cards.yellow++;
    }
    stats.score = [s.score[0], s.score[1]];
    charging = s.players.map((p) => p.charge >= 0);
  };
  return Object.assign(watch, { stats });
}

/** A ball in the air from out wide in the final third to a teammate in the box (as the lob button crosses). */
function isCross(s: MatchState, kicker: number, receiver: number): boolean {
  const k = s.players[kicker];
  const r = s.players[receiver];
  const other = k.team === 0 ? 1 : 0;
  const finalThird = k.pos.x * attackSign(s, k.team) > s.pitch.length / 6;
  const wide = Math.abs(k.pos.z) > s.pitch.width * 0.2;
  return s.ball.vel.y > 2 && finalThird && wide && inOwnBox(s, other, r.pos.x, r.pos.z);
}

/** Fouls in a match: those with advantage played, and those given as free kicks or penalties. */
export function fouls(stats: MatchStats): number {
  const c = stats.calls;
  return (c.advantage ?? 0) + (c.freekick ?? 0) + (c.penalty ?? 0);
}
