"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import type { MealPlanEntry, MealSlot, Recipe, RecipeSource } from "@/lib/supabase/database.types";
import { addDays, type IsoDate } from "@/lib/date";
import { REHEAT_DAYS } from "@/lib/planner";

/**
 * Reads and writes for recipes and the meal plan. Same contract as the other
 * data layers: throw with a message fit to show, never fail quietly.
 */

function fail(context: string, error: { message: string; code?: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export async function fetchRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabaseBrowser().from("recipes").select("*").order("name", { ascending: true });
  fail("Could not load recipes", error);
  return data ?? [];
}

export type NewRecipe = {
  name: string;
  servings: number;
  ingredients: string[];
  method: string | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  source: RecipeSource;
};

export async function addRecipe(householdId: string, userId: string, recipe: NewRecipe): Promise<Recipe> {
  const { data, error } = await supabaseBrowser()
    .from("recipes")
    .insert({
      household_id: householdId,
      created_by: userId,
      ...recipe,
      name: recipe.name.trim(),
      ingredients: recipe.ingredients.map((l) => l.trim()).filter(Boolean),
      method: recipe.method?.trim() || null,
    })
    .select()
    .single();
  // The name index is case-insensitive and household-wide.
  if (error?.code === "23505") throw new Error(`"${recipe.name.trim()}" is already in your recipes.`);
  fail("Could not save that recipe", error);
  if (!data) throw new Error("Could not save that recipe.");
  return data;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("recipes").delete().eq("id", id);
  fail("Could not delete that recipe", error);
}

/**
 * The plan for a week, plus the few days before it: a Sunday cook's leftovers
 * can land on Monday, and the cook row is needed to show where they came from.
 */
export async function fetchPlan(weekStart: IsoDate, weekEnd: IsoDate): Promise<MealPlanEntry[]> {
  const { data, error } = await supabaseBrowser()
    .from("meal_plan")
    .select("*")
    .gte("planned_on", addDays(weekStart, -REHEAT_DAYS))
    .lte("planned_on", weekEnd)
    .order("planned_on", { ascending: true });
  fail("Could not load the plan", error);
  return data ?? [];
}

export async function addPlanRow(
  householdId: string,
  userId: string,
  row: { planned_on: IsoDate; meal: MealSlot; recipe_id: string; eaters: number; leftovers_from: string | null },
): Promise<MealPlanEntry> {
  const { data, error } = await supabaseBrowser()
    .from("meal_plan")
    .insert({ household_id: householdId, created_by: userId, ...row })
    .select()
    .single();
  if (error?.code === "23505") throw new Error("Something is already planned for that meal.");
  // The leftovers trigger raises plain-English messages; show them as they are.
  if (error?.code === "23514") throw new Error(error.message);
  fail("Could not add that to the plan", error);
  if (!data) throw new Error("Could not add that to the plan.");
  return data;
}

export async function updateEaters(id: string, eaters: number): Promise<void> {
  const { error } = await supabaseBrowser().from("meal_plan").update({ eaters }).eq("id", id);
  fail("Could not change that", error);
}

/** Deleting a cooked meal also removes the leftovers that depended on it (ON DELETE CASCADE). */
export async function deletePlanRow(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("meal_plan").delete().eq("id", id);
  fail("Could not remove that from the plan", error);
}
