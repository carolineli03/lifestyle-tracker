import "server-only";
import { fail } from "./core";
import type { AiContext } from "./server";
import { plausibleLocalDate } from "./server";
import type { DayBudget, PantryLine } from "./prompts";

/**
 * What Cook and Prep plan read, fetched on the server through the caller's own
 * RLS rather than accepted from the browser — the model only ever sees this
 * person's real kitchen and their own day.
 */
export async function loadKitchen(
  { supabase, userId }: AiContext,
  date: string,
): Promise<{ pantry: PantryLine[]; budget: DayBudget } | ReturnType<typeof fail>> {
  if (!plausibleLocalDate(date)) {
    return fail(400, "bad_request", "That date doesn't look like today. Reload the page and try again.");
  }

  const [pantry, entries, profile] = await Promise.all([
    supabase.from("pantry_items").select("name, quantity, location, expires_on"),
    supabase.from("entries").select("kcal, protein_g").eq("user_id", userId).eq("logged_on", date),
    supabase.from("profiles").select("kcal_target, protein_target").eq("user_id", userId).maybeSingle(),
  ]);

  const firstError = pantry.error ?? entries.error ?? profile.error;
  if (firstError) return fail(500, "internal", `Could not read your kitchen: ${firstError.message}`);

  const items = pantry.data ?? [];
  if (items.length === 0) {
    return fail(400, "bad_request", "The kitchen is empty. Add what you have on the Kitchen tab first.");
  }

  return {
    pantry: items,
    budget: {
      kcalTarget: profile.data?.kcal_target ?? null,
      proteinTarget: profile.data?.protein_target ?? null,
      eatenKcal: (entries.data ?? []).reduce((s, e) => s + Number(e.kcal), 0),
      eatenProtein: (entries.data ?? []).reduce((s, e) => s + Number(e.protein_g), 0),
    },
  };
}
