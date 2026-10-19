import { describe, expect, it } from "vitest";
import { ReplayPlayer, ReplayRecorder } from "../src/game/replay";
import {
  aiIntents,
  cloneParams,
  createMatch,
  DEFAULT_PARAMS,
  IDLE,
  PITCH_5_A_SIDE,
  Rng,
  stepMatch,
  type Intent,
} from "../src/sim";

describe("goal replays (docs/specs/10 §7)", () => {
  it("re-running the recorded inputs reproduces the match exactly, computer players included", () => {
    const p = cloneParams(DEFAULT_PARAMS);
    const cpu = (s: Parameters<typeof aiIntents>[0]) => aiIntents(s, p);
    const s = createMatch({
      seed: 4,
      pitch: PITCH_5_A_SIDE,
      teamSize: 5,
      rules: { halfTicks: 20000, fouls: true },
    });
    const rec = new ReplayRecorder();
    const rng = new Rng(9);
    let held: Intent = { ...IDLE };
    for (let t = 0; t < 900; t++) {
      if (t % 12 === 0) {
        held = {
          ...IDLE,
          moveX: rng.range(-1, 1),
          moveZ: rng.range(-1, 1),
          pass: rng.next() < 0.2,
          shoot: rng.next() < 0.1,
        };
      }
      rec.record(s, [held]);
      stepMatch(s, [held], p, cpu);
    }
    const clip = rec.clip(5, s.tick);
    expect(clip).not.toBeNull();
    const player = new ReplayPlayer(clip!, p, cpu);
    expect(player.progress).toBe(0);
    while (!player.done) player.step();
    expect(player.progress).toBe(1);
    expect(player.state).toEqual(s);
  });

  it("keeps only the last few seconds", () => {
    const s = createMatch({ seed: 1, pitch: PITCH_5_A_SIDE, teamSize: 5 });
    const rec = new ReplayRecorder(120, 60);
    for (let t = 0; t < 1000; t++) {
      rec.record(s, [{ ...IDLE }]);
      stepMatch(s, [{ ...IDLE }], DEFAULT_PARAMS);
    }
    const clip = rec.clip(30, s.tick)!;
    // Asked for 30 s, but only ~2–3 s were kept.
    expect(clip.inputs.length).toBeLessThanOrEqual(180);
    expect(s.tick - clip.start.tick).toBe(clip.inputs.length);
  });
});
