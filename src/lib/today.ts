"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import type { Entry, Food, Movement, WeighIn } from "@/lib/supabase/database.types";
import { weekBounds, type IsoDate } from "@/lib/date";
import type { MacroTotals } from "@/lib/totals";

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
};

function fail(context: string, error: { message: string } | null): never | void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export async function fetchDay(date: IsoDate): Promise<DayData> {
  const sb = supabaseBrowser();
  const { start, end } = weekBounds(date);

  const [entries, movement, weighIn] = await Promise.all([
    sb.from("entries").select("*").eq("logged_on", date).order("created_at", { ascending: true }),
    sb
      .from("movement")
      .select("*")
      .gte("logged_on", start)
      .lte("logged_on", end)
      .order("created_at", { ascending: true }),
    sb.from("weigh_ins").select("*").eq("logged_on", date).maybeSingle(),
  ]);

  fail("Could not load the food log", entries.error);
  fail("Could not load movement", movement.error);
  fail("Could not load the weigh-in", weighIn.error);

  return {
    entries: entries.data ?? [],
    weekMovement: movement.data ?? [],
    weighIn: weighIn.data ?? null,
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

export async function logEntry(
  date: IsoDate,
  name: string,
  macros: MacroTotals,
  remember = true,
): Promise<Entry> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("log_entry", {
    p_name: name,
    p_kcal: Math.round(macros.kcal),
    p_protein_g: macros.protein_g,
    p_carb_g: macros.carb_g,
    p_fat_g: macros.fat_g,
    p_logged_on: date,
    p_remember: remember,
  });
  fail("Could not save that entry", error);
  if (!data) throw new Error("Could not save that entry: the database returned nothing.");
  return data;
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
): Promise<Movement> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("movement")
    .insert({ user_id: userId, logged_on: date, kind: kind.trim(), minutes })
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
