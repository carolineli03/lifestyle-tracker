"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

export type IceboxClient = SupabaseClient<Database>;

let cached: IceboxClient | null = null;

/**
 * Browser-side Supabase client. Safe to hold in the client bundle: the anon
 * key does nothing without a session, and every table is behind RLS.
 */
export function supabaseBrowser(): IceboxClient {
  cached ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return cached;
}
