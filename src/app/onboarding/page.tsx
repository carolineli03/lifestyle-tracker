import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { getSession } from "@/lib/household";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Set up your kitchen · Lifestyle Tracker" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/start");
  if (session.household) redirect("/today");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-5 py-10">
      <span
        className="mb-5 grid h-14 w-14 place-items-center rounded-[18px]"
        style={{ background: "var(--pine)", color: "var(--on-pine)", boxShadow: "var(--shadow-fab)" }}
        aria-hidden="true"
      >
        <Icon name="leaf" size={28} strokeWidth={2} />
      </span>
      <h1 className="font-display text-3xl font-bold">One kitchen, two people</h1>
      <p className="mt-2 max-w-[46ch] text-[15px] text-muted">
        The kitchen, shopping list, recipes and meal plan are shared. Your food log, movement and weight stay
        private to you.
      </p>
      <OnboardingForm />
    </main>
  );
}
