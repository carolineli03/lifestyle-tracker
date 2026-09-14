"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import type { AiUsage, Movement, Profile, WeighIn } from "@/lib/supabase/database.types";
import type { IsoDate } from "@/lib/date";

/**
 * Every read and write the Progress tab makes. Same contract as lib/today.ts:
 * throw with the message Postgres gave, and let the screen show it.
 */

export type ProfilePatch = Partial<Omit<Profile, "user_id" | "created_at" | "updated_at">>;

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** Every weigh-in, oldest first. One a day at most, so years stay small. */
export async function fetchWeighIns(): Promise<WeighIn[]> {
  const { data, error } = await supabaseBrowser()
    .from("weigh_ins")
    .select("*")
    .order("logged_on", { ascending: true });
  fail("Could not load weigh-ins", error);
  return data ?? [];
}

export async function fetchMovementSince(from: IsoDate): Promise<Movement[]> {
  const { data, error } = await supabaseBrowser()
    .from("movement")
    .select("*")
    .gte("logged_on", from)
    .order("logged_on", { ascending: true });
  fail("Could not load movement", error);
  return data ?? [];
}

export type UsageRow = Pick<AiUsage, "model" | "input_tokens" | "output_tokens" | "ok">;

/** This person's AI calls since `from` (an instant: the start of their local month). */
export async function fetchAiUsageSince(from: Date): Promise<UsageRow[]> {
  const { data, error } = await supabaseBrowser()
    .from("ai_usage")
    .select("model, input_tokens, output_tokens, ok")
    .gte("created_at", from.toISOString());
  fail("Could not load AI usage", error);
  return data ?? [];
}

/**
 * An update, not an upsert: the sign-up trigger always creates the profile
 * row, so a missing row is a real fault worth surfacing rather than papering
 * over with an insert.
 */
export async function saveProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  const { data, error } = await supabaseBrowser()
    .from("profiles")
    .update(patch)
    .eq("user_id", userId)
    .select()
    .single();
  fail("Could not save your targets", error);
  if (!data) throw new Error("Could not save your targets: the database returned nothing.");
  return data;
}
