/**
 * Calories burned, estimated from the Compendium of Physical Activities idea:
 * kcal = MET × body weight (kg) × hours. It's an estimate, and the UI calls
 * it one ("~140 kcal").
 */

const KG_PER_LB = 0.45359237;

/** First match wins, so more specific words come first. */
const METS: ReadonlyArray<{ words: readonly string[]; met: number }> = [
  { words: ["run", "jog", "sprint"], met: 9.8 },
  { words: ["swim"], met: 7 },
  { words: ["bike", "cycl", "spin", "peloton"], met: 7.5 },
  { words: ["hike"], met: 6 },
  { words: ["hiit", "crossfit", "circuit"], met: 8 },
  { words: ["row"], met: 7 },
  { words: ["strength", "weights", "lift", "gym"], met: 5 },
  { words: ["dance", "zumba"], met: 5 },
  { words: ["tennis", "pickleball", "basketball", "soccer", "golf"], met: 5.5 },
  { words: ["walk"], met: 3.5 },
  { words: ["pilates"], met: 3 },
  { words: ["yoga", "stretch"], met: 2.5 },
];

export const DEFAULT_MET = 4;

export function metFor(kind: string): number {
  const k = kind.toLowerCase();
  return METS.find((m) => m.words.some((w) => k.includes(w)))?.met ?? DEFAULT_MET;
}

/** Null when there's no weight to base it on: no guessing a body weight. */
export function caloriesBurned(kind: string, minutes: number, weightLb: number | null): number | null {
  if (weightLb === null || !(weightLb > 0) || !(minutes > 0)) return null;
  return Math.round(metFor(kind) * weightLb * KG_PER_LB * (minutes / 60));
}

/** The day's calorie target with exercise added back, when that setting is on. */
export function adjustedTarget(target: number | null, burned: number, eatBack: boolean): number | null {
  if (target === null) return null;
  return eatBack ? target + Math.round(burned) : target;
}
