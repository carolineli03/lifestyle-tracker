import { redirect } from "next/navigation";
import { getSession } from "@/lib/household";
import { supabaseServer } from "@/lib/supabase/server";
import { TargetsClient } from "./TargetsClient";

export const metadata = { title: "Targets & goals · Lifestyle Tracker" };

export default async function TargetsPage() {
  const session = await getSession();
  if (!session) redirect("/start");

  const supabase = await supabaseServer();
  const [{ data: profile }, { data: latest }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", session.userId).maybeSingle(),
    supabase.from("weigh_ins").select("weight_lb").order("logged_on", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return (
    <TargetsClient userId={session.userId} initialProfile={profile ?? null} latestWeight={latest ? Number(latest.weight_lb) : null} />
  );
}
