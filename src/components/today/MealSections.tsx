"use client";

import { useState } from "react";
import type { Entry, MealSlot } from "@/lib/supabase/database.types";
import { groupByMeal, SECTION_LABEL } from "@/lib/meals";
import { addDays, describeDate, type IsoDate } from "@/lib/date";
import { MEAL_SLOTS } from "@/lib/planner";
import { ErrorNote } from "@/components/ErrorNote";

/** The day's log as Breakfast / Lunch / Dinner / Snacks, each with its own total and a "Copy from…" shortcut. */
export function MealSections({
  date,
  entries,
  removing,
  onRemove,
  onCopy,
}: {
  date: IsoDate;
  entries: readonly Entry[];
  removing: string | null;
  onRemove: (id: string) => void;
  onCopy: (fromDate: IsoDate, fromMeal: MealSlot, toMeal: MealSlot) => Promise<number>;
}) {
  const sections = groupByMeal(entries);
  const total = Math.round(entries.reduce((s, e) => s + Number(e.kcal), 0));

  return (
    <section className="card mt-4 p-5" aria-labelledby="eaten-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="eaten-heading" className="font-display text-lg font-semibold">
          Eaten
        </h2>
        <span className="text-[14px] text-muted">
          <span className="font-semibold text-ink">{total.toLocaleString()}</span> kcal
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3">
        {sections.map((section) => (
          <div key={section.key} className="border-t pt-3" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold">{SECTION_LABEL[section.key]}</h3>
              <div className="flex items-center gap-2">
                {section.key !== "other" && (
                  <CopyMeal date={date} toMeal={section.key} onCopy={onCopy} />
                )}
                <span className="text-[14px] text-muted">{section.kcal.toLocaleString()}</span>
              </div>
            </div>

            {section.entries.length === 0 ? (
              <p className="text-[13px] text-muted">Nothing yet.</p>
            ) : (
              <ul className="mt-1 grid grid-cols-1">
                {section.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px]">{entry.name}</p>
                      <p className="text-[12px] text-muted">
                        {Math.round(Number(entry.protein_g))}p · {Math.round(Number(entry.carb_g))}c · {Math.round(Number(entry.fat_g))}f
                        {entry.fiber_g !== null ? ` · ${Math.round(Number(entry.fiber_g))}g fiber` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-[16px] font-semibold">{Math.round(entry.kcal).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(entry.id)}
                      disabled={removing === entry.id}
                      aria-label={`Remove ${entry.name}`}
                      className="shrink-0 rounded-field text-muted"
                      style={{ width: 44, height: 44 }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CopyMeal({
  date,
  toMeal,
  onCopy,
}: {
  date: IsoDate;
  toMeal: MealSlot;
  onCopy: (fromDate: IsoDate, fromMeal: MealSlot, toMeal: MealSlot) => Promise<number>;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<IsoDate>(() => addDays(date, -1));
  const [fromMeal, setFromMeal] = useState<MealSlot>(toMeal);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="text-[13px] font-semibold"
        style={{ color: "var(--pine)", minHeight: 32 }}
        onClick={() => {
          setFrom(addDays(date, -1));
          setFromMeal(toMeal);
          setResult(null);
          setOpen(true);
        }}
      >
        Copy from…
      </button>
    );
  }

  async function copy(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const n = await onCopy(from, fromMeal, toMeal);
      if (n === 0) setResult(`Nothing logged for ${SECTION_LABEL[fromMeal].toLowerCase()} on ${describeDate(from, date)}.`);
      else setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't copy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[640px] rounded-t-card border bg-card p-5 shadow-lg" style={{ borderColor: "var(--line)" }} role="dialog" aria-label={`Copy into ${SECTION_LABEL[toMeal]}`}>
      <h3 className="font-display text-lg font-semibold">Copy into {SECTION_LABEL[toMeal].toLowerCase()}</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="grid grid-cols-1 gap-1">
          <span className="text-[12px] font-semibold text-muted">From day</span>
          <input type="date" className="field" value={from} max={date} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="grid grid-cols-1 gap-1">
          <span className="text-[12px] font-semibold text-muted">Meal</span>
          <select className="field" value={fromMeal} onChange={(e) => setFromMeal(e.target.value as MealSlot)}>
            {MEAL_SLOTS.map((m) => (
              <option key={m} value={m}>
                {SECTION_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {result && <p className="mt-2 text-[14px] text-muted" role="status">{result}</p>}
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={() => void copy()} disabled={busy || !from}>
          {busy ? "Copying…" : "Copy"}
        </button>
      </div>
    </div>
  );
}
