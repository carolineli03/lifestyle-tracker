import { addDays, weekBounds, type IsoDate } from "@/lib/date";
import type { MealPlanEntry, MealSlot } from "@/lib/supabase/database.types";

/**
 * Meal-plan arithmetic: how many portions to cook, which later meals can take
 * leftovers, and the week at a glance. Pure, so the numbers are tested.
 *
 * A cooked row feeds its own eaters plus every leftover row pointing at it.
 */

export type PlanRow = Pick<MealPlanEntry, "id" | "planned_on" | "meal" | "recipe_id" | "eaters" | "leftovers_from">;

export const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** The usual limit for cooked food kept in the fridge; the database enforces it too. */
export const REHEAT_DAYS = 4;

export function mealOrder(meal: MealSlot): number {
  return MEAL_SLOTS.indexOf(meal);
}

export function isCooked(row: PlanRow): boolean {
  return row.leftovers_from === null;
}

export function portionsToMake(cooked: PlanRow, rows: readonly PlanRow[]): number {
  return rows.filter((r) => r.leftovers_from === cooked.id).reduce((sum, r) => sum + r.eaters, cooked.eaters);
}

/** "the recipe as written", "1.5× the recipe", "half the recipe". */
export function scaleNote(portions: number, recipeServings: number): string {
  if (!(recipeServings > 0)) return "";
  const ratio = portions / recipeServings;
  if (Math.abs(ratio - 1) < 0.01) return "the recipe as written";
  if (Math.abs(ratio - 0.5) < 0.01) return "half the recipe";
  if (Math.abs(ratio - 2) < 0.01) return "double the recipe";
  const shown = Math.round(ratio * 100) / 100;
  return `${shown}× the recipe`;
}

export type Slot = { planned_on: IsoDate; meal: MealSlot };

/**
 * Later meals that could eat this cook's leftovers: after the cooked meal,
 * within REHEAT_DAYS, and not already planned.
 */
export function leftoverCandidates(cooked: PlanRow, rows: readonly PlanRow[], reheatDays = REHEAT_DAYS): Slot[] {
  const taken = new Set(rows.map((r) => `${r.planned_on}|${r.meal}`));
  const slots: Slot[] = [];
  for (let d = 0; d <= reheatDays; d++) {
    const day = addDays(cooked.planned_on, d);
    for (const meal of MEAL_SLOTS) {
      if (d === 0 && mealOrder(meal) <= mealOrder(cooked.meal)) continue;
      if (taken.has(`${day}|${meal}`)) continue;
      slots.push({ planned_on: day, meal });
    }
  }
  return slots;
}

/** Monday-first days of the week containing `date`. */
export function weekDays(date: IsoDate): IsoDate[] {
  const { start } = weekBounds(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export type WeekSummary = { cookingDays: number; portions: number; leftoverMeals: number };

/** Counts only what falls inside the week, though leftovers may come from a cook the week before. */
export function weekSummary(rows: readonly PlanRow[], week: readonly IsoDate[]): WeekSummary {
  const inWeek = new Set(week);
  const cooked = rows.filter((r) => isCooked(r) && inWeek.has(r.planned_on));
  return {
    cookingDays: new Set(cooked.map((r) => r.planned_on)).size,
    portions: cooked.reduce((sum, r) => sum + portionsToMake(r, rows), 0),
    leftoverMeals: rows.filter((r) => !isCooked(r) && inWeek.has(r.planned_on)).length,
  };
}

/** Rows for one day, in meal order. */
export function rowsForDay(rows: readonly PlanRow[], day: IsoDate): PlanRow[] {
  return rows.filter((r) => r.planned_on === day).sort((a, b) => mealOrder(a.meal) - mealOrder(b.meal));
}
