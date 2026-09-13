import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/household";
import { FridgeClient } from "./FridgeClient";

export const metadata = { title: "Fridge · Lifestyle Tracker" };

export default async function FridgePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.household) redirect("/onboarding");

  return (
    <>
      <PageHeader title="Fridge" />
      <FridgeClient userId={session.userId} household={session.household} />
    </>
  );
}
