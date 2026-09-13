import { redirect } from "next/navigation";
import { getSession } from "@/lib/household";
import { supabaseServer } from "@/lib/supabase/server";
import { TodayClient } from "./TodayClient";

export const metadata = { title: "Today · Lifestyle Tracker" };

export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Targets are date-independent, so they can be fetched here and handed down
  // — one fewer round trip before the hero number can render.
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", session.userId)
    .maybeSingle();

  // No page heading here on purpose: the date stepper says which day you are
  // looking at, and the bottom nav already says which tab you are on. A third
  // "Today" was just noise.
  return <TodayClient userId={session.userId} profile={profile ?? null} />;
}
