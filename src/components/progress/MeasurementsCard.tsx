"use client";

import { useCallback, useEffect, useState } from "react";
import type { BodyMeasurement } from "@/lib/supabase/database.types";
import { fromIsoDate, type IsoDate } from "@/lib/date";
import { deleteMeasurement, fetchMeasurements, saveMeasurement } from "@/lib/progress";
import { ErrorNote } from "@/components/ErrorNote";

const KINDS = ["waist", "hips", "chest", "neck", "arm", "thigh"] as const;

const title = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);

export function MeasurementsCard({ userId, today }: { userId: string; today: IsoDate }) {
  const [rows, setRows] = useState<BodyMeasurement[] | null>(null);
  const [kind, setKind] = useState<string>("waist");
  const [custom, setCustom] = useState("");
  const [date, setDate] = useState<IsoDate>(today);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setRows(await fetchMeasurements()), []);

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load measurements."));
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = kind === "custom" ? custom.trim() : kind;
    const inches = Number(value);
    if (!name) return setError("Name the measurement.");
    if (!(inches > 0 && inches < 200)) return setError("Enter the measurement in inches.");
    setBusy(true);
    setError(null);
    try {
      await saveMeasurement(userId, date, name, inches);
      setValue("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  const byKind = new Map<string, BodyMeasurement[]>();
  for (const r of rows ?? []) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);

  return (
    <section className="card mt-4 p-5" aria-labelledby="measure-heading">
      <h2 id="measure-heading" className="font-display text-lg font-semibold">
        Measurements
      </h2>

      <form onSubmit={(e) => void submit(e)} className="mt-3 grid gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            <span className="text-[12px] font-semibold text-muted">What</span>
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {title(k)}
                </option>
              ))}
              <option value="custom">Other…</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[12px] font-semibold text-muted">Inches</span>
            <input className="field" type="number" inputMode="decimal" step={0.25} min={1} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        </div>
        {kind === "custom" && (
          <input className="field" aria-label="Measurement name" placeholder="e.g. calf" value={custom} onChange={(e) => setCustom(e.target.value)} />
        )}
        <div className="flex gap-2">
          <input className="field flex-1" type="date" aria-label="Date measured" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {rows && rows.length === 0 && <p className="mt-3 text-[14px] text-muted">No measurements yet. Same spot, same time of day works best.</p>}

      {byKind.size > 0 && (
        <ul className="mt-4 grid gap-3">
          {[...byKind.entries()].map(([k, list]) => {
            const first = list[0]!;
            const last = list.at(-1)!;
            const change = Math.round((Number(last.value_in) - Number(first.value_in)) * 100) / 100;
            return (
              <li key={k} className="rounded-field p-3" style={{ border: "1px solid var(--line)" }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold">{title(k)}</span>
                  <span className="text-[14px]">
                    <span className="font-display text-[18px] font-bold">{Number(last.value_in)}</span> in
                    {list.length > 1 && (
                      <span className="ml-2 text-[13px] text-muted">
                        {change > 0 ? "+" : change < 0 ? "−" : "±"}
                        {Math.abs(change)} since {fromIsoDate(first.measured_on).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </span>
                </div>
                {list.length > 1 && <Sparkline values={list.map((r) => Number(r.value_in))} label={`${title(k)} trend`} />}
                <button
                  type="button"
                  className="mt-1 text-[12px] text-muted underline"
                  style={{ minHeight: 32 }}
                  onClick={() => void deleteMeasurement(last.id).then(load).catch((c: unknown) => setError(c instanceof Error ? c.message : "That didn't delete."))}
                >
                  Delete latest ({fromIsoDate(last.measured_on).toLocaleDateString(undefined, { day: "numeric", month: "short" })})
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Sparkline({ values, label }: { values: readonly number[]; label: string }) {
  const W = 300;
  const H = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * (W - 8) + 4).toFixed(1)},${(H - 4 - ((v - min) / span) * (H - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${label}: from ${values[0]} to ${values.at(-1)} inches`} className="mt-2 block">
      <polyline points={points} fill="none" stroke="var(--pine)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
