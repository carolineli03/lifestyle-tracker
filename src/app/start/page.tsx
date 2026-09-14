import { Suspense } from "react";
import { Icon } from "@/components/ui/icons";
import { StartGuest } from "./StartGuest";

export const metadata = { title: "Lifestyle Tracker" };

export default function StartPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-5 py-10">
      <span
        className="mb-5 grid h-14 w-14 place-items-center rounded-[18px]"
        style={{ background: "var(--pine)", color: "var(--on-pine)", boxShadow: "var(--shadow-fab)" }}
        aria-hidden="true"
      >
        <Icon name="leaf" size={28} strokeWidth={2} />
      </span>
      <h1 className="font-display text-4xl font-bold">Lifestyle Tracker</h1>
      <p className="mt-2 max-w-[42ch] text-[15px] text-muted">
        What&rsquo;s in the kitchen, what you ate, and what to cook next.
      </p>
      <Suspense fallback={null}>
        <StartGuest />
      </Suspense>
    </main>
  );
}
