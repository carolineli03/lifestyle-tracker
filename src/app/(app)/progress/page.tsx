import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/household";
import { supabaseServer } from "@/lib/supabase/server";
import { ProgressClient } from "./ProgressClient";

export const metadata = { title: "Progress · Icebox" };

export default async function ProgressPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // The profile is date-independent, so it comes from the server. Weigh-ins
  // and movement are read client-side: "the last seven days" is a local day.
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", session.userId)
    .maybeSingle();

  return (
    <>
      <PageHeader title="Progress" />
      <ProgressClient userId={session.userId} initialProfile={profile ?? null} />
    </>
  );
}
