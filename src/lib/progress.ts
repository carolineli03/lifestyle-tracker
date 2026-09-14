"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import type { AiUsage, BodyMeasurement, Entry, Movement, Profile, ProgressPhoto, WaterLog, WeighIn } from "@/lib/supabase/database.types";
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

// --- weekly report ------------------------------------------------------------

export async function fetchReportData(from: IsoDate) {
  const sb = supabaseBrowser();
  const [entries, weighIns, movement, water, days] = await Promise.all([
    sb.from("entries").select("logged_on, kcal, protein_g").gte("logged_on", from),
    sb.from("weigh_ins").select("logged_on, weight_lb").gte("logged_on", from),
    sb.from("movement").select("logged_on, minutes, kcal").gte("logged_on", from),
    sb.from("water_logs").select("logged_on, amount_oz").gte("logged_on", from),
    sb.from("entries").select("logged_on"),
  ]);
  fail("Could not load the weekly report", entries.error ?? weighIns.error ?? movement.error ?? water.error ?? days.error);
  return {
    entries: entries.data ?? [],
    weighIns: weighIns.data ?? [],
    movement: movement.data ?? [],
    water: water.data ?? [],
    loggedDays: (days.data ?? []).map((d) => d.logged_on),
  };
}

// --- body measurements ----------------------------------------------------------

export async function fetchMeasurements(): Promise<BodyMeasurement[]> {
  const { data, error } = await supabaseBrowser()
    .from("body_measurements")
    .select("*")
    .order("measured_on", { ascending: true });
  fail("Could not load measurements", error);
  return data ?? [];
}

/** One reading per kind per day: saving again replaces it. */
export async function saveMeasurement(userId: string, measuredOn: IsoDate, kind: string, valueIn: number): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("body_measurements")
    .upsert(
      { user_id: userId, measured_on: measuredOn, kind: kind.trim().toLowerCase(), value_in: valueIn },
      { onConflict: "user_id,measured_on,kind" },
    );
  fail("Could not save that measurement", error);
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("body_measurements").delete().eq("id", id);
  fail("Could not delete that measurement", error);
}

// --- progress photos ------------------------------------------------------------

export const PHOTO_BUCKET = "progress-photos";

export type PhotoWithUrl = ProgressPhoto & { url: string | null };

/** Rows plus short-lived signed URLs. The bucket is private; nothing has a public link. */
export async function fetchPhotos(): Promise<PhotoWithUrl[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.from("progress_photos").select("*").order("taken_on", { ascending: false });
  fail("Could not load progress photos", error);
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const signed = await sb.storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600);
  fail("Could not open progress photos", signed.error);
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? null }));
}

export async function uploadPhoto(userId: string, takenOn: IsoDate, jpegBase64: string, note: string | null): Promise<void> {
  const sb = supabaseBrowser();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const bytes = Uint8Array.from(atob(jpegBase64), (c) => c.charCodeAt(0));
  const upload = await sb.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  fail("Could not upload that photo", upload.error);
  const { error } = await sb.from("progress_photos").insert({ user_id: userId, taken_on: takenOn, storage_path: path, note });
  if (error) {
    // Don't leave an orphaned file behind if the row couldn't be written.
    await sb.storage.from(PHOTO_BUCKET).remove([path]);
    fail("Could not save that photo", error);
  }
}

export async function deletePhoto(photo: ProgressPhoto): Promise<void> {
  const sb = supabaseBrowser();
  const removed = await sb.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  fail("Could not delete that photo", removed.error);
  // Storage reports a delete it wasn't allowed to do as success with nothing
  // removed. Keep the row so the photo doesn't silently become an orphan file.
  if ((removed.data ?? []).length === 0) throw new Error("Could not delete that photo: the file wasn't removed.");
  const { error } = await sb.from("progress_photos").delete().eq("id", photo.id);
  fail("Could not delete that photo", error);
}

// --- export -----------------------------------------------------------------------

/** Everything this person logged, for the CSV export. Supabase caps a select at 1,000 rows, so page through. */
async function all<T>(table: "entries" | "weigh_ins" | "movement" | "water_logs" | "body_measurements", order: string): Promise<T[]> {
  const sb = supabaseBrowser();
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select("*").order(order, { ascending: true }).range(from, from + 999);
    fail(`Could not export ${table.replace("_", " ")}`, error);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function fetchExport() {
  const [entries, weighIns, movement, water, measurements] = await Promise.all([
    all<Entry>("entries", "logged_on"),
    all<WeighIn>("weigh_ins", "logged_on"),
    all<Movement>("movement", "logged_on"),
    all<WaterLog>("water_logs", "logged_on"),
    all<BodyMeasurement>("body_measurements", "measured_on"),
  ]);
  return { entries, weighIns, movement, water, measurements };
}
