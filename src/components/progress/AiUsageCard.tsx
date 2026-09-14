"use client";

import { useEffect, useState } from "react";
import { usageTotals, type UsageTotals } from "@/lib/ai/cost";
import { fetchAiUsageSince } from "@/lib/progress";

/** What the AI features cost this calendar month, from this person's own usage log. */
export function AiUsageCard() {
  const [totals, setTotals] = useState<UsageTotals | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); // local midnight on the 1st
    fetchAiUsageSince(monthStart)
      .then((rows) => {
        if (!cancelled) setTotals(usageTotals(rows));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load AI usage.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const month = new Date().toLocaleDateString(undefined, { month: "long" });

  return (
    <section className="card mt-4 p-5" aria-labelledby="ai-usage-heading">
      <h2 id="ai-usage-heading" className="font-display text-lg font-semibold">
        AI this month
      </h2>
      {error ? (
        <p className="mt-2 text-[14px]" style={{ color: "var(--tomato)" }}>
          {error}
        </p>
      ) : !totals ? (
        <p className="mt-2 text-[14px] text-muted">Loading…</p>
      ) : (
        <>
          <p className="mt-2 font-display text-[28px] font-bold leading-none">
            ${totals.dollars < 0.01 && totals.calls > 0 ? "<0.01" : totals.dollars.toFixed(2)}
          </p>
          <p className="mt-2 text-[13px] text-muted">
            {totals.calls} {totals.calls === 1 ? "request" : "requests"} in {month}
            {totals.failed > 0 ? ` (${totals.failed} failed)` : ""} ·{" "}
            {(totals.inputTokens + totals.outputTokens).toLocaleString()} tokens. Estimated from list prices.
          </p>
        </>
      )}
    </section>
  );
}
