/**
 * Pure arithmetic for the Today tab. Kept away from components so it can be
 * tested directly — the numbers on this screen are the whole point of the app.
 */

export type MacroTotals = {
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

export type Targets = {
  kcal: number | null;
  protein: number | null;
  carb: number | null;
  fat: number | null;
};

export const ZERO_TOTALS: MacroTotals = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };

export function sumMacros(rows: readonly Partial<MacroTotals>[]): MacroTotals {
  return rows.reduce<MacroTotals>(
    (acc, r) => ({
      kcal: acc.kcal + (r.kcal ?? 0),
      protein_g: acc.protein_g + (r.protein_g ?? 0),
      carb_g: acc.carb_g + (r.carb_g ?? 0),
      fat_g: acc.fat_g + (r.fat_g ?? 0),
    }),
    { ...ZERO_TOTALS },
  );
}

/**
 * Calories left in the day. Can go negative — going over is information, and
 * clamping it to zero would hide the one number worth seeing.
 */
export function caloriesRemaining(eaten: number, target: number | null): number | null {
  if (target === null) return null;
  return Math.round(target - eaten);
}

/** Fraction of a target consumed, clamped to [0, 1] for bar widths only. */
export function progressFraction(eaten: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.min(1, Math.max(0, eaten / target));
}

/** True once a target is exceeded — drives the colour change, not the width. */
export function isOver(eaten: number, target: number | null): boolean {
  return target !== null && target > 0 && eaten > target;
}

/**
 * Scales a saved food's macros to a portion. Rounds calories to whole numbers
 * and macros to one decimal, because "18.399999999999999 g" helps nobody.
 */
export function scalePortion(base: MacroTotals, servings: number): MacroTotals {
  const factor = Number.isFinite(servings) && servings > 0 ? servings : 0;
  return {
    kcal: Math.round(base.kcal * factor),
    protein_g: round1(base.protein_g * factor),
    carb_g: round1(base.carb_g * factor),
    fat_g: round1(base.fat_g * factor),
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Ranks the food library for search-as-you-type: name matches first by
 * position (a prefix match beats a mid-word one), then by how often it has
 * been logged. Runs against an in-memory copy, so it costs nothing per
 * keystroke.
 */
export function rankFoods<T extends { name: string; times_logged: number }>(
  foods: readonly T[],
  query: string,
  limit = 8,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...foods].sort((a, b) => b.times_logged - a.times_logged).slice(0, limit);
  }
  return foods
    .map((f) => ({ f, at: f.name.toLowerCase().indexOf(q) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at || b.f.times_logged - a.f.times_logged)
    .slice(0, limit)
    .map((m) => m.f);
}
