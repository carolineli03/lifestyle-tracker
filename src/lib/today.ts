"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import type { Entry, Food, MealSlot, Movement, WaterLog, WeighIn } from "@/lib/supabase/database.types";
import { weekBounds, type IsoDate } from "@/lib/date";
import type { MacroTotals } from "@/lib/totals";
import type { Nutrients } from "@/lib/nutrients";
import { caloriesBurned } from "@/lib/exercise";
import { copyMeal } from "@/lib/meals";

/**
 * Every read and write the Today tab makes.
 *
 * These throw on failure with the message Postgres actually gave, rather than
 * returning a null the UI would have to guess about. The screen catches them
 * and shows what happened — a silent failure here means a meal that looks
 * logged and is not.
 */

export type DayData = {
  entries: Entry[];
  /** The whole Monday-start week containing the day, for the running total. */
  weekMovement: Movement[];
  weighIn: WeighIn | null;
  water: WaterLog[];
  /** The most recent weigh-in on or before the day, for calories-burned estimates. */
  latestWeightLb: number | null;
};

function fail(context: string, error: { message: string } | null): never | void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export async function fetchDay(date: IsoDate): Promise<DayData> {
  const sb = supabaseBrowser();
  const { start, end } = weekBounds(date);

  const [entries, movement, weighIn, water, latest] = await Promise.all([
    sb.from("entries").select("*").eq("logged_on", date).order("created_at", { ascending: true }),
    sb
      .from("movement")
      .select("*")
      .gte("logged_on", start)
      .lte("logged_on", end)
      .order("created_at", { ascending: true }),
    sb.from("weigh_ins").select("*").eq("logged_on", date).maybeSingle(),
    sb.from("water_logs").select("*").eq("logged_on", date).order("created_at", { ascending: true }),
    sb.from("weigh_ins").select("weight_lb").lte("logged_on", date).order("logged_on", { ascending: false }).limit(1).maybeSingle(),
  ]);

  fail("Could not load the food log", entries.error);
  fail("Could not load movement", movement.error);
  fail("Could not load the weigh-in", weighIn.error);
  fail("Could not load water", water.error);
  fail("Could not load your latest weight", latest.error);

  return {
    entries: entries.data ?? [],
    weekMovement: movement.data ?? [],
    weighIn: weighIn.data ?? null,
    water: water.data ?? [],
    latestWeightLb: latest.data ? Number(latest.data.weight_lb) : null,
  };
}

/**
 * The whole food library in one go. It is a household's own list — tens to
 * low hundreds of rows — so pulling it once and filtering in memory makes
 * search-as-you-type genuinely instant instead of debounce-and-hope.
 */
export async function fetchFoods(): Promise<Food[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("foods")
    .select("*")
    .order("times_logged", { ascending: false })
    .limit(500);
  fail("Could not load your saved foods", error);
  return data ?? [];
}

export type LogInput = {
  name: string;
  /** What was eaten. */
  macros: MacroTotals;
  nutrients?: Nutrients;
  meal: MealSlot | null;
  remember?: boolean;
  /** One serving, used only when the library hasn't seen this food yet. */
  perServing?: MacroTotals;
  nutrientsPerServing?: Nutrients;
  servingLabel?: string | null;
  barcode?: string | null;
};

function optional(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : value;
}

export async function logEntry(date: IsoDate, input: LogInput): Promise<Entry> {
  const sb = supabaseBrowser();
  const { macros, nutrients, perServing, nutrientsPerServing } = input;
  const { data, error } = await sb.rpc("log_entry", {
    p_name: input.name,
    p_kcal: Math.round(macros.kcal),
    p_protein_g: macros.protein_g,
    p_carb_g: macros.carb_g,
    p_fat_g: macros.fat_g,
    p_logged_on: date,
    p_remember: input.remember ?? true,
    p_meal: input.meal ?? undefined,
    p_fiber_g: optional(nutrients?.fiber_g),
    p_sugar_g: optional(nutrients?.sugar_g),
    p_sodium_mg: optional(nutrients?.sodium_mg),
    p_serving_kcal: perServing ? Math.round(perServing.kcal) : undefined,
    p_serving_protein_g: perServing?.protein_g,
    p_serving_carb_g: perServing?.carb_g,
    p_serving_fat_g: perServing?.fat_g,
    p_serving_fiber_g: optional(nutrientsPerServing?.fiber_g),
    p_serving_sugar_g: optional(nutrientsPerServing?.sugar_g),
    p_serving_sodium_mg: optional(nutrientsPerServing?.sodium_mg),
    p_serving_label: input.servingLabel ?? undefined,
    p_barcode: input.barcode ?? undefined,
  });
  fail("Could not save that entry", error);
  if (!data) throw new Error("Could not save that entry: the database returned nothing.");
  return data;
}

/** Copies one meal from another day into this day's chosen meal. Returns how many entries were copied. */
export async function copyMealFrom(
  userId: string,
  fromDate: IsoDate,
  fromMeal: MealSlot,
  toDate: IsoDate,
  toMeal: MealSlot,
): Promise<number> {
  const sb = supabaseBrowser();
  const source = await sb.from("entries").select("*").eq("logged_on", fromDate).eq("meal", fromMeal);
  fail("Could not read that day", source.error);
  const rows = copyMeal(source.data ?? [], fromMeal, toDate, toMeal, userId);
  if (rows.length === 0) return 0;
  const { error } = await sb.from("entries").insert(rows);
  fail("Could not copy that meal", error);
  return rows.length;
}

/** Days with any food logged since `since`, for the streak. Just the dates, nothing else. */
export async function fetchLoggedDays(since: IsoDate): Promise<IsoDate[]> {
  const { data, error } = await supabaseBrowser().from("entries").select("logged_on").gte("logged_on", since);
  fail("Could not load your streak", error);
  return (data ?? []).map((r) => r.logged_on);
}

/** Returns the new row's id, so an Undo can remove exactly this entry. */
export async function addWater(userId: string, date: IsoDate, amountOz: number): Promise<string> {
  const { data, error } = await supabaseBrowser()
    .from("water_logs")
    .insert({ user_id: userId, logged_on: date, amount_oz: amountOz })
    .select("id")
    .single();
  fail("Could not add water", error);
  if (!data) throw new Error("Could not add water.");
  return data.id;
}

export async function deleteWater(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("water_logs").delete().eq("id", id);
  fail("Could not undo that", error);
}

export async function deleteEntry(id: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb.from("entries").delete().eq("id", id);
  fail("Could not remove that entry", error);
}

export async function addMovement(
  userId: string,
  date: IsoDate,
  kind: string,
  minutes: number,
  weightLb: number | null,
): Promise<Movement> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("movement")
    .insert({ user_id: userId, logged_on: date, kind: kind.trim(), minutes, kcal: caloriesBurned(kind, minutes, weightLb) })
    .select()
    .single();
  fail("Could not save that movement", error);
  if (!data) throw new Error("Could not save that movement.");
  return data;
}

export async function deleteMovement(id: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb.from("movement").delete().eq("id", id);
  fail("Could not remove that movement", error);
}

export async function saveWeighIn(
  userId: string,
  date: IsoDate,
  weightLb: number,
): Promise<WeighIn> {
  const sb = supabaseBrowser();
  // One weigh-in per person per day; the unique constraint on
  // (user_id, logged_on) is what makes this an update rather than a duplicate.
  const { data, error } = await sb
    .from("weigh_ins")
    .upsert(
      { user_id: userId, logged_on: date, weight_lb: weightLb },
      { onConflict: "user_id,logged_on" },
    )
    .select()
    .single();
  fail("Could not save that weigh-in", error);
  if (!data) throw new Error("Could not save that weigh-in.");
  return data;
}

export async function deleteWeighIn(id: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb.from("weigh_ins").delete().eq("id", id);
  fail("Could not remove that weigh-in", error);
}
