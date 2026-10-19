import { cloneState, stepMatch, type Intent, type MatchState, type SimParams } from "../sim";

/** What a replay needs: where to start, and every human input from there on. */
export interface ReplayClip {
  start: MatchState;
  /** `inputs[k]` are the humans' intents for the k-th tick after `start`. */
  inputs: Intent[][];
  /** Ticks to run unseen before the clip starts showing (from the snapshot to the wanted start). */
  lead: number;
}

/**
 * Remembers the last few seconds of a match so a goal can be replayed (docs/specs/10 §7). The simulation is
 * deterministic, so that's just a snapshot every second plus the humans' input for every tick: the replay
 * re-runs the same moments, computer players included.
 */
export class ReplayRecorder {
  private snapshots: MatchState[] = [];
  private inputs: { tick: number; intents: Intent[] }[] = [];

  constructor(
    private readonly keepTicks = 8 * 60,
    private readonly snapshotEvery = 60,
  ) {}

  /** Call just before `state` is stepped with `intents`. */
  record(state: MatchState, intents: readonly Intent[]): void {
    if (this.snapshots.length === 0 || state.tick % this.snapshotEvery === 0)
      this.snapshots.push(cloneState(state));
    this.inputs.push({ tick: state.tick, intents: intents.map((i) => ({ ...i })) });
    const oldest = state.tick - this.keepTicks;
    while (this.snapshots.length > 1 && this.snapshots[1].tick <= oldest) this.snapshots.shift();
    while (this.inputs.length > 0 && this.inputs[0].tick < this.snapshots[0].tick) this.inputs.shift();
  }

  clear(): void {
    this.snapshots = [];
    this.inputs = [];
  }

  /** About `seconds` of play that end at `endTick`, or null if nothing was recorded. */
  clip(seconds: number, endTick: number): ReplayClip | null {
    const from = endTick - Math.round(seconds * 60);
    // The latest snapshot at or before `from` (or the oldest, if the match is younger than the clip).
    let start: MatchState | undefined = this.snapshots[0];
    for (const s of this.snapshots) if (s.tick <= from) start = s;
    if (!start) return null;
    const startTick = start.tick;
    const inputs = this.inputs.filter((r) => r.tick >= startTick && r.tick < endTick).map((r) => r.intents);
    return { start: cloneState(start), inputs, lead: Math.max(0, from - startTick) };
  }
}

/** Plays a clip back one tick at a time, exactly as it happened. */
export class ReplayPlayer {
  state: MatchState;
  prev: MatchState;
  private next = 0;

  constructor(
    private readonly clip: ReplayClip,
    private readonly params: SimParams,
    private readonly cpu?: (state: MatchState) => Intent[],
  ) {
    this.state = cloneState(clip.start);
    while (this.next < clip.lead && !this.done) this.advance();
    this.prev = cloneState(this.state);
  }

  get done(): boolean {
    return this.next >= this.clip.inputs.length;
  }

  /** 0 at the start of the shown part, 1 at the end. */
  get progress(): number {
    const shown = this.clip.inputs.length - this.clip.lead;
    return shown > 0 ? (this.next - this.clip.lead) / shown : 1;
  }

  step(): void {
    if (this.done) return;
    this.prev = cloneState(this.state);
    this.advance();
  }

  private advance(): void {
    stepMatch(this.state, this.clip.inputs[this.next], this.params, this.cpu);
    this.next++;
  }
}
