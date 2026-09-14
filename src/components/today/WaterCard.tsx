"use client";

import { useState } from "react";
import type { WaterLog } from "@/lib/supabase/database.types";
import { progressFraction } from "@/lib/totals";
import { ErrorNote } from "@/components/ErrorNote";

export function WaterCard({
  logs,
  goalOz,
  onAdd,
  onUndo,
}: {
  logs: readonly WaterLog[];
  goalOz: number;
  onAdd: (oz: number) => Promise<void>;
  onUndo: (id: string) => Promise<void>;
}) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = Math.round(logs.reduce((s, l) => s + Number(l.amount_oz), 0) * 10) / 10;
  const last = logs.at(-1);

  async function run(fn: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-4 p-5" aria-labelledby="water-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="water-heading" className="font-display text-lg font-semibold">
          Water
        </h2>
        <span className="text-[14px] text-muted">
          <span className="font-semibold text-ink">{total}</span>
          {goalOz > 0 ? ` / ${goalOz} oz` : " oz"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Water: ${total} of ${goalOz} ounces`}
        aria-valuenow={Math.round(progressFraction(total, goalOz) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 overflow-hidden rounded-pill"
        style={{ height: 6, background: "var(--line)" }}
      >
        <div style={{ width: `${progressFraction(total, goalOz) * 100}%`, height: "100%", background: "var(--pine)", transition: "width 200ms ease" }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[8, 16].map((oz) => (
          <button key={oz} type="button" className="chip" disabled={busy} onClick={() => void run(() => onAdd(oz))}>
            +{oz} oz
          </button>
        ))}
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const oz = Number(custom);
            if (oz > 0) void run(() => onAdd(oz).then(() => setCustom("")));
          }}
        >
          <input
            aria-label="Ounces of water"
            className="field"
            style={{ width: 80, minHeight: 36, padding: "0.25rem 0.5rem" }}
            type="number"
            inputMode="decimal"
            min={1}
            placeholder="oz"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button type="submit" className="chip" disabled={busy || !(Number(custom) > 0)}>
            Add
          </button>
        </form>
        {last && (
          <button type="button" className="chip" disabled={busy} onClick={() => void run(() => onUndo(last.id))}>
            Undo {Number(last.amount_oz)} oz
          </button>
        )}
      </div>
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
    </section>
  );
}
