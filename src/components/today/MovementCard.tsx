"use client";

import { useState } from "react";
import type { Movement } from "@/lib/supabase/database.types";
import { ErrorNote } from "@/components/ErrorNote";
import { progressFraction } from "@/lib/totals";
import type { IsoDate } from "@/lib/date";

const PRESETS: ReadonlyArray<{ kind: string; minutes: number }> = [
  { kind: "Walk", minutes: 15 },
  { kind: "Walk", minutes: 30 },
  { kind: "Strength", minutes: 30 },
  { kind: "Yoga", minutes: 20 },
  { kind: "Bike", minutes: 30 },
];

export function MovementCard({
  date,
  weekMovement,
  weeklyGoal,
  onAdd,
  onRemove,
}: {
  date: IsoDate;
  weekMovement: readonly Movement[];
  weeklyGoal: number | null;
  onAdd: (kind: string, minutes: number) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [kind, setKind] = useState("");
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forToday = weekMovement.filter((m) => m.logged_on === date);
  const weekTotal = weekMovement.reduce((sum, m) => sum + m.minutes, 0);

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

  async function addCustom(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const mins = Number(minutes);
    if (!kind.trim()) {
      setError("Give the activity a name.");
      return;
    }
    if (!Number.isFinite(mins) || mins <= 0) {
      setError("Minutes needs to be a number above zero.");
      return;
    }
    await run(async () => {
      await onAdd(kind, Math.round(mins));
      setKind("");
      setMinutes("");
    });
  }

  return (
    <section className="card mt-4 p-5">
      <h2 className="font-display text-lg font-semibold">Movement</h2>

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-[13px]">
          <span className="font-semibold text-muted">This week</span>
          <span className="text-muted">
            <span className="text-ink">{weekTotal}</span>
            {weeklyGoal ? ` / ${weeklyGoal} min` : " min"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Movement this week: ${weekTotal} of ${weeklyGoal ?? "no"} minutes`}
          aria-valuenow={Math.round(progressFraction(weekTotal, weeklyGoal) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="overflow-hidden rounded-pill"
          style={{ height: 6, background: "var(--line)" }}
        >
          <div
            style={{
              width: `${progressFraction(weekTotal, weeklyGoal) * 100}%`,
              height: "100%",
              background: "var(--pine)",
              transition: "width 200ms ease",
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={`${p.kind}-${p.minutes}`}
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => void run(() => onAdd(p.kind, p.minutes))}
          >
            {p.kind} {p.minutes}
          </button>
        ))}
      </div>

      <form onSubmit={addCustom} className="mt-3 flex gap-2">
        <input
          aria-label="Activity"
          className="field flex-1"
          placeholder="Activity"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        />
        <input
          aria-label="Minutes"
          type="number"
          inputMode="numeric"
          min={1}
          className="field"
          style={{ width: 92 }}
          placeholder="min"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <button type="submit" className="btn btn-quiet" disabled={busy}>
          Add
        </button>
      </form>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {forToday.length > 0 && (
        <ul className="mt-3 grid gap-1">
          {forToday.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 border-b py-2 last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <span className="flex-1 truncate text-[15px]">{m.kind}</span>
              <span className="shrink-0 text-[15px] text-muted">{m.minutes} min</span>
              <button
                type="button"
                onClick={() => void run(() => onRemove(m.id))}
                aria-label={`Remove ${m.kind}`}
                className="shrink-0 rounded-field text-muted"
                style={{ width: 44, height: 44 }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
