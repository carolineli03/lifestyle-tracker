import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/household";
import { CookClient } from "./CookClient";

export const metadata = { title: "Cook · Lifestyle Tracker" };

export default async function CookPage() {
  const session = await getSession();
  if (!session) redirect("/start");
  if (!session.household) redirect("/onboarding");

  return (
    <>
      <PageHeader title="Cook" />
      <CookClient householdId={session.household.id} userId={session.userId} />
    </>
  );
}
