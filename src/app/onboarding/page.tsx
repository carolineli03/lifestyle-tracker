import { redirect } from "next/navigation";
import { getSession } from "@/lib/household";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Set up your kitchen · Lifestyle Tracker" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.household) redirect("/today");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-5 py-10">
      <h1 className="font-display text-3xl font-bold">One kitchen, two people</h1>
      <p className="mt-2 max-w-[46ch] text-[15px] text-muted">
        The fridge and the food library are shared. Your food log, movement and weight stay
        private to you.
      </p>
      <OnboardingForm />
    </main>
  );
}
