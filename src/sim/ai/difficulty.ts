import type { AiParams, KeeperParams, SimParams } from "../params";
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
      keeperReactionTicks: 20,
      aimError: 0.35,
      tackleChance: 0.15,
      slideChance: 0,
      telegraphTicks: 10,
      shotCurl: 0,
      passWillingness: 0.2,
    },
    keeper: { reach: 0.5, diveSpeed: 5, catchSpeed: 15 },
    assists: { autoSwitch: true, aimHelp: true, passLead: true, autoSprint: true },
  },
  normal: {
    ai: {},
    keeper: {},
    assists: { autoSwitch: true, aimHelp: false, passLead: true, autoSprint: false },
  },
  hard: {
    ai: {
      reactionTicks: 5,
      keeperReactionTicks: 13,
      aimError: 0.06,
      tackleChance: 0.55,
      slideChance: 0.1,
      telegraphTicks: 4,
      shotCurl: 0.7,
      passWillingness: 0.5,
    },
    keeper: { reach: 0.65, diveSpeed: 6.5, catchSpeed: 21 },
    assists: { autoSwitch: true, aimHelp: false, passLead: false, autoSprint: false },
  },
};

/** Apply a difficulty on top of `params` (in place). */
export function applyDifficulty(params: SimParams, difficulty: Difficulty): void {
  Object.assign(params.ai, DIFFICULTY[difficulty].ai);
  Object.assign(params.keeper, DIFFICULTY[difficulty].keeper);
}
