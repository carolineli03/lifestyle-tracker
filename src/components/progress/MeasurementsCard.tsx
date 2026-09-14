"use client";

import { useCallback, useEffect, useState } from "react";
import type { BodyMeasurement } from "@/lib/supabase/database.types";
import { fromIsoDate, type IsoDate } from "@/lib/date";
import { deleteMeasurement, fetchMeasurements, saveMeasurement } from "@/lib/progress";
import { ErrorNote } from "@/components/ErrorNote";
import { Icon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/ListRow";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

const KINDS = ["waist", "hips", "chest", "neck", "arm", "thigh"] as const;

const title = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);
const short = (iso: IsoDate) => fromIsoDate(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;
}

/** One row per body part: latest, change and trend. Adding and history open sheets. */
export function MeasurementsCard({ userId, today }: { userId: string; today: IsoDate }) {
  const toast = useToast();
  const [rows, setRows] = useState<BodyMeasurement[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [openKind, setOpenKind] = useState<string | null>(null);
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

  function startAdding(preset?: string): void {
    setKind(preset && (KINDS as readonly string[]).includes(preset) ? preset : preset ? "custom" : "waist");
    setCustom(preset && !(KINDS as readonly string[]).includes(preset) ? preset : "");
    setDate(today);
    setValue("");
    setError(null);
    setOpenKind(null);
    setAdding(true);
  }

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
      await load();
      setAdding(false);
      toast({ message: `${title(name)} saved · ${inches} in` });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: BodyMeasurement): Promise<void> {
    setBusy(true);
    try {
      await deleteMeasurement(row.id);
      await load();
      if ((byKind.get(row.kind)?.length ?? 0) <= 1) setOpenKind(null);
      toast({ message: `Deleted ${title(row.kind).toLowerCase()} from ${short(row.measured_on)}` });
    } catch (cause) {
      toast({ message: cause instanceof Error ? cause.message : "That didn't delete." });
    } finally {
      setBusy(false);
    }
  }

  const byKind = new Map<string, BodyMeasurement[]>();
  for (const r of rows ?? []) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r]);
  const history = openKind ? (byKind.get(openKind) ?? []) : [];

  return (
    <section className="mt-3" aria-labelledby="measure-heading">
      <div className="mb-2 mt-5 flex items-center justify-between gap-2 px-1">
        <h2 id="measure-heading" className="t-label">
          Measurements
        </h2>
        <button type="button" className="btn btn-quiet" style={{ minHeight: 40, paddingInline: 14 }} onClick={() => startAdding()}>
          <Icon name="plus" size={17} strokeWidth={2.2} />
          Add
        </button>
      </div>

      {error && !adding && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {rows === null ? (
        <p className="t-meta px-1">Loading…</p>
      ) : byKind.size === 0 ? (
        <div className="card">
          <EmptyState icon="ruler" text="No measurements yet. Same spot, same time of day works best." />
        </div>
      ) : (
        <ul className="list">
          {[...byKind.entries()].map(([k, list]) => {
            const first = list[0]!;
            const last = list.at(-1)!;
            const change = Math.round((Number(last.value_in) - Number(first.value_in)) * 100) / 100;
            return (
              <li key={k}>
                <button type="button" className="list-row" onClick={() => setOpenKind(k)}>
                  <span className="w-[72px] shrink-0 text-[15px] font-semibold">{title(k)}</span>
                  <span className="min-w-0 flex-1">
                    {list.length > 1 ? (
                      <Sparkline values={list.map((r) => Number(r.value_in))} label={`${title(k)} trend`} />
                    ) : (
                      <span className="t-meta">{short(last.measured_on)}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right leading-tight">
                    <span className="block text-[15px]">
                      <span className="font-display text-[18px] font-bold">{Number(last.value_in)}</span> in
                    </span>
                    {list.length > 1 && <span className="t-meta block">{signed(change)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a measurement"
        footer={
          <button type="submit" form="measure-form" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        }
      >
        <form id="measure-form" onSubmit={(e) => void submit(e)} className="grid grid-cols-1 gap-3">
          <div role="radiogroup" aria-label="What" className="flex flex-wrap gap-1.5">
            {[...KINDS, "custom"].map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} data-active={kind === k} className="chip" onClick={() => setKind(k)}>
                {k === "custom" ? "Other…" : title(k)}
              </button>
            ))}
          </div>
          {kind === "custom" && (
            <input className="field" aria-label="Measurement name" placeholder="e.g. calf" value={custom} onChange={(e) => setCustom(e.target.value)} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="grid grid-cols-1 gap-1">
              <span className="t-meta font-semibold">Inches</span>
              <input className="field" type="number" inputMode="decimal" step={0.25} min={1} value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <label className="grid grid-cols-1 gap-1">
              <span className="t-meta font-semibold">Date</span>
              <input className="field" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
        </form>
      </Sheet>

      <Sheet open={openKind !== null} onClose={() => setOpenKind(null)} title={openKind ? title(openKind) : ""}>
        {openKind && (
          <>
            {history.length > 1 && <Sparkline values={history.map((r) => Number(r.value_in))} label={`${title(openKind)} trend`} height={56} />}
            <ul className="list mt-3">
              {[...history].reverse().map((r) => (
                <li key={r.id} className="list-row">
                  <span className="min-w-0 flex-1 text-[15px]">{fromIsoDate(r.measured_on).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                  <span className="text-[15px] font-semibold">{Number(r.value_in)} in</span>
                  <button type="button" className="icon-btn text-muted" disabled={busy} onClick={() => void remove(r)} aria-label={`Delete ${short(r.measured_on)}`}>
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => startAdding(openKind)}>
              <Icon name="plus" size={18} strokeWidth={2.2} />
              Add {title(openKind).toLowerCase()}
            </button>
          </>
        )}
      </Sheet>
    </section>
  );
}

function Sparkline({ values, label, height = 28 }: { values: readonly number[]; label: string; height?: number }) {
  const W = 300;
  const H = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * (W - 8) + 4).toFixed(1)},${(H - 4 - ((v - min) / span) * (H - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={`${label}: from ${values[0]} to ${values.at(-1)} inches`} className="block">
      <polyline points={points} fill="none" stroke="var(--pine)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
