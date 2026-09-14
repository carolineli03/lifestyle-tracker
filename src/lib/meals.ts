import type { Entry, MealSlot } from "@/lib/supabase/database.types";
import { MEAL_LABEL, MEAL_SLOTS } from "@/lib/planner";

/**
 * Breakfast / lunch / dinner / snacks on the Today log. Entries from before
 * meals existed have no meal and show under "Other" instead of being guessed.
 */

export type SectionKey = MealSlot | "other";

export const SECTION_LABEL: Record<SectionKey, string> = { ...MEAL_LABEL, snack: "Snacks", other: "Other" };

/**
 * Which meal you're most likely logging, from the phone's own clock:
 * breakfast until 10:30, lunch until 15:00, dinner until 21:00, then snacks.
 */
export function defaultMeal(now: Date = new Date()): MealSlot {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10 * 60 + 30) return "breakfast";
  if (minutes < 15 * 60) return "lunch";
  if (minutes < 21 * 60) return "dinner";
  return "snack";
}

export type MealSection<E> = { key: SectionKey; entries: E[]; kcal: number };

/** Sections in meal order. Empty meals are kept (they hold the Copy button); "Other" only appears when it has entries. */
export function groupByMeal<E extends Pick<Entry, "meal" | "kcal">>(entries: readonly E[]): MealSection<E>[] {
  const sections: MealSection<E>[] = MEAL_SLOTS.map((key) => ({ key, entries: [], kcal: 0 }));
  const other: MealSection<E> = { key: "other", entries: [], kcal: 0 };
  for (const e of entries) {
    const section = e.meal ? sections.find((s) => s.key === e.meal) ?? other : other;
    section.entries.push(e);
    section.kcal += Number(e.kcal);
  }
  for (const s of [...sections, other]) s.kcal = Math.round(s.kcal);
  return other.entries.length > 0 ? [...sections, other] : sections;
}

type CopyableEntry = Pick<
  Entry,
  "name" | "kcal" | "protein_g" | "carb_g" | "fat_g" | "fiber_g" | "sugar_g" | "sodium_mg" | "food_id" | "meal"
>;

/** The rows to insert when copying one meal from another day, re-dated and re-homed. */
export function copyMeal(
  source: readonly CopyableEntry[],
  fromMeal: MealSlot,
  toDate: string,
  toMeal: MealSlot,
  userId: string,
) {
  return source
    .filter((e) => e.meal === fromMeal)
    .map((e) => ({
      user_id: userId,
      logged_on: toDate,
      meal: toMeal,
      name: e.name,
      kcal: Number(e.kcal),
      protein_g: Number(e.protein_g),
      carb_g: Number(e.carb_g),
      fat_g: Number(e.fat_g),
      fiber_g: e.fiber_g === null ? null : Number(e.fiber_g),
      sugar_g: e.sugar_g === null ? null : Number(e.sugar_g),
      sodium_mg: e.sodium_mg === null ? null : Number(e.sodium_mg),
      food_id: e.food_id,
    }));
}
