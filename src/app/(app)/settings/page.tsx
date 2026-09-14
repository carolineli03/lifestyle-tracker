import { redirect } from "next/navigation";
import { getSession } from "@/lib/household";
import { supabaseServer } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings · Lifestyle Tracker" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/start");
  if (!session.household) redirect("/onboarding");

  const supabase = await supabaseServer();
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", session.userId).maybeSingle(),
    supabase.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", session.household.id),
  ]);

  return (
    <SettingsClient
      household={session.household}
      members={count ?? 1}
      isGuest={session.isGuest}
      email={session.email}
      profile={profile ?? null}
    />
  );
}
