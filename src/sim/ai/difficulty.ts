import { DEFAULT_PARAMS, type AiParams, type KeeperParams, type SimParams, type Skill } from "../params";
import type { Assists } from "../state";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

interface Preset {
  ai: Partial<AiParams>;
  keeper: Partial<KeeperParams>;
  assists: Assists;
}

/**
 * The three levels (docs/specs/11 §2). Normal is the defaults in params.ts. Difficulty only changes reaction
 * time, accuracy, decision quality and keeper sharpness: never speed.
 */
export const DIFFICULTY: Record<Difficulty, Preset> = {
  easy: {
    ai: {
      reactionTicks: 18,
      keeperReactionTicks: 16,
      aimError: 0.35,
      tackleChance: 0.15,
      slideChance: 0,
      telegraphTicks: 10,
      shotCurl: 0,
      passWillingness: 0.2,
      lineMisread: 4,
    },
    keeper: { reach: 0.6, diveSpeed: 7, catchSpeed: 15 },
    assists: { autoSwitch: true, aimHelp: true, passLead: true, autoSprint: true, runOntoPass: true },
  },
  normal: {
    ai: {},
    keeper: {},
    assists: { autoSwitch: true, aimHelp: false, passLead: true, autoSprint: false, runOntoPass: true },
  },
  hard: {
    ai: {
      reactionTicks: 5,
      keeperReactionTicks: 10,
      aimError: 0.06,
      tackleChance: 0.4,
      slideChance: 0.1,
      telegraphTicks: 4,
      shotCurl: 0.7,
      passWillingness: 0.5,
      lineMisread: 1,
    },
    keeper: { reach: 0.69, diveSpeed: 7.8, catchSpeed: 21 },
    assists: { autoSwitch: true, aimHelp: false, passLead: false, autoSprint: false, runOntoPass: true },
  },
};

/** The AI and keeper values of a level. */
export function skillFor(difficulty: Difficulty): Skill {
  const preset = DIFFICULTY[difficulty];
  return {
    ai: { ...DEFAULT_PARAMS.ai, ...preset.ai },
    keeper: { ...DEFAULT_PARAMS.keeper, ...preset.keeper },
  };
}

/**
 * Make `cpuTeam` play at `difficulty` (in place). Its values go into `params.ai` and `params.keeper`, which the
 * tuning panel edits, so the panel tunes the opponent; the other team (the humans' teammates and keeper) plays
 * at Normal whatever the level.
 */
export function applyDifficulty(params: SimParams, difficulty: Difficulty, cpuTeam: 0 | 1 = 1): void {
  Object.assign(params.ai, DIFFICULTY[difficulty].ai);
  Object.assign(params.keeper, DIFFICULTY[difficulty].keeper);
  const normal = skillFor("normal");
  params.teamSkill = cpuTeam === 1 ? [normal, null] : [null, normal];
}
