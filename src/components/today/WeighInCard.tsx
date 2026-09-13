"use client";

import { useEffect, useState } from "react";
import type { WeighIn } from "@/lib/supabase/database.types";
import { ErrorNote } from "@/components/ErrorNote";
import { describeDate, type IsoDate } from "@/lib/date";

export function WeighInCard({
  date,
  weighIn,
  onSave,
  onRemove,
}: {
  date: IsoDate;
  weighIn: WeighIn | null;
  onSave: (weightLb: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stepping to another day should show that day's weight, not the last one
  // that happened to be in the box.
  useEffect(() => {
    setValue(weighIn ? String(Number(weighIn.weight_lb)) : "");
    setError(null);
  }, [weighIn, date]);

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const lb = Number(value);
    if (!Number.isFinite(lb) || lb <= 0) {
      setError("Enter a weight in pounds.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(lb);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-4 p-5">
      <h2 className="font-display text-lg font-semibold">Weigh-in</h2>
      <p className="mt-1 text-[13px] text-muted">
        {describeDate(date)} · one per day, saving again replaces it.
      </p>

      <form onSubmit={save} className="mt-3 flex gap-2">
        <input
          aria-label="Weight in pounds"
          type="number"
          inputMode="decimal"
          min={0}
          step={0.1}
          className="field flex-1"
          placeholder="lb"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {weighIn ? "Update" : "Save"}
        </button>
        {weighIn && (
          <button
            type="button"
            className="btn btn-quiet"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onRemove(weighIn.id)
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : "That didn't delete."),
                )
                .finally(() => setBusy(false));
            }}
          >
            Clear
          </button>
        )}
      </form>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
    </section>
  );
}
