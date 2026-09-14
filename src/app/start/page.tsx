import { Suspense } from "react";
import { StartGuest } from "./StartGuest";

export const metadata = { title: "Lifestyle Tracker" };

export default function StartPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center px-5 py-10">
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
