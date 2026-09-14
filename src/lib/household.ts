import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import type { Household } from "@/lib/supabase/database.types";

export type Session = {
  userId: string;
  email: string | null;
  isGuest: boolean;
  household: Household | null;
};

/**
 * The one query every authenticated page needs: who is this, and which
 * kitchen are they in. Returns null when there is no valid session.
 *
 * RLS means the household select can be unqualified — a user can only ever
 * see households they belong to.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("households")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    // A guest from /start, with no email yet. Signing out would orphan their
    // data, so the UI offers "add your email" instead.
    isGuest: user.is_anonymous === true,
    household: data ?? null,
  };
}
