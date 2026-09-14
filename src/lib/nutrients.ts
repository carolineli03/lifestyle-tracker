/**
 * Fiber, sugar and sodium. Kept apart from the macros because they are often
 * unknown: a food typed in by hand has no sodium figure, and "unknown" must
 * never be summed as zero and presented as a real low number.
 */

export type Nutrients = {
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
};

export const NO_NUTRIENTS: Nutrients = { fiber_g: null, sugar_g: null, sodium_mg: null };

export const NUTRIENT_FIELDS: ReadonlyArray<{ key: keyof Nutrients; label: string; unit: string }> = [
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "sugar_g", label: "Sugar", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];

/** Suggested daily figures shown as placeholders: 25 g fiber (the low end of US guidance), under 50 g sugar, under 2,300 mg sodium. */
export const NUTRIENT_SUGGESTIONS = { fiber_target: 25, sugar_limit: 50, sodium_limit: 2300 } as const;

export function scaleNutrients(base: Nutrients, servings: number): Nutrients {
  const f = Number.isFinite(servings) && servings > 0 ? servings : 0;
  const scale = (v: number | null, digits: number) => (v === null ? null : Math.round(v * f * 10 ** digits) / 10 ** digits);
  return { fiber_g: scale(base.fiber_g, 1), sugar_g: scale(base.sugar_g, 1), sodium_mg: scale(base.sodium_mg, 0) };
}

export type NutrientTotals = { [K in keyof Nutrients]: { amount: number; known: number; missing: number } };

/**
 * A day's totals, counting how many entries actually had a figure, so the UI
 * can say "12 g fiber (2 foods had no fiber info)" instead of implying 12 g is complete.
 */
export function sumNutrients(rows: readonly Partial<Record<keyof Nutrients, number | string | null>>[]): NutrientTotals {
  const empty = () => ({ amount: 0, known: 0, missing: 0 });
  const totals: NutrientTotals = { fiber_g: empty(), sugar_g: empty(), sodium_mg: empty() };
  for (const row of rows) {
    for (const { key } of NUTRIENT_FIELDS) {
      const v = row[key];
      if (v === null || v === undefined || v === "") totals[key].missing += 1;
      else {
        totals[key].amount += Number(v);
        totals[key].known += 1;
      }
    }
  }
  for (const { key } of NUTRIENT_FIELDS) totals[key].amount = Math.round(totals[key].amount * 10) / 10;
  return totals;
}
