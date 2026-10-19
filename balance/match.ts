import {
  aiIntents,
  createMatch,
  PITCH_5_A_SIDE,
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
}

/** Players per team and the length of a half, as in the game's default match (`?minutes=5`). */
export const TEAM_SIZE = 5;
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
    pitch: PITCH_5_A_SIDE,
    teamSize: TEAM_SIZE,
    humans: options.humans ?? [],
    rules: { halfTicks: options.halfTicks ?? HALF_TICKS, fouls: true },
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
  };
  let pass: { to: number; tick: number; dist: number } | null = null;
  let lastCall = -1;
  /** Who was winding up a shot last tick (the shoot button held on the ball). */
  let charging: boolean[] = [];
  const watch = (s: MatchState) => {
    const b = s.ball;
    if (s.phase.kind === "play" && b.owner >= 0) stats.possession[s.players[b.owner].team]++;
    if (b.kickedAt === s.tick - 1 && b.owner < 0 && b.lastTouch >= 0) {
      // A kick this tick: a pass if it was aimed at a teammate, a shot if it's heading for goal fast.
      const kicker = s.players[b.lastTouch];
      pass = null;
      if (b.intendedReceiver >= 0) {
        const r = s.players[b.intendedReceiver];
        stats.passesTried++;
        const dist = Math.hypot(r.pos.x - kicker.pos.x, r.pos.z - kicker.pos.z);
        pass = { to: b.intendedReceiver, tick: s.tick - 1, dist };
      } else if (charging[b.lastTouch] || CONTACT_SHOTS.has(kicker.action.kind)) {
        stats.shots[kicker.team]++;
      }
    } else if (pass && b.owner >= 0) {
      if (b.owner === pass.to) stats.passes.push({ dist: pass.dist, time: (s.tick - pass.tick) / TICK_RATE });
      pass = null;
    }
    const e = s.lastEvent;
    if (e && e.tick !== lastCall) {
      lastCall = e.tick;
      stats.calls[e.kind] = (stats.calls[e.kind] ?? 0) + 1;
    }
    stats.score = [s.score[0], s.score[1]];
    charging = s.players.map((p) => p.charge >= 0);
  };
  return Object.assign(watch, { stats });
}

/** Fouls in a match: those with advantage played, and those given as free kicks or penalties. */
export function fouls(stats: MatchStats): number {
  const c = stats.calls;
  return (c.advantage ?? 0) + (c.freekick ?? 0) + (c.penalty ?? 0);
}
