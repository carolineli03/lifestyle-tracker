import { redirect } from "next/navigation";
import { getSession } from "@/lib/household";
import { FridgeClient } from "./FridgeClient";

export const metadata = { title: "Kitchen · Lifestyle Tracker" };

export default async function FridgePage() {
  const session = await getSession();
  if (!session) redirect("/start");
  if (!session.household) redirect("/onboarding");

  return (
    <FridgeClient userId={session.userId} household={session.household} />
  );
}
