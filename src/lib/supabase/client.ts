"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

export type AppClient = SupabaseClient<Database>;

let cached: AppClient | null = null;

/**
 * Browser-side Supabase client. Safe to hold in the client bundle: the anon
 * key does nothing without a session, and every table is behind RLS.
 */
export function supabaseBrowser(): AppClient {
  cached ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return cached;
}
