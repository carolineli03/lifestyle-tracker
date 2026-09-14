"use client";

import { useState } from "react";
import { toCsv } from "@/lib/csv";
import { fetchExport } from "@/lib/progress";
import { todayIso } from "@/lib/date";
import { ErrorNote } from "@/components/ErrorNote";

function download(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Your own rows as spreadsheet files, built in the browser. Nothing leaves your Supabase except to you. */
export function ExportCard() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(): Promise<void> {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const d = await fetchExport();
      const stamp = todayIso();
      download(
        `food-log-${stamp}.csv`,
        toCsv(
          d.entries.map((e) => ({ ...e, meal: e.meal ?? "" })),
          ["logged_on", "meal", "name", "kcal", "protein_g", "carb_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg"],
        ),
      );
      download(`weigh-ins-${stamp}.csv`, toCsv(d.weighIns, ["logged_on", "weight_lb"]));
      download(`movement-${stamp}.csv`, toCsv(d.movement, ["logged_on", "kind", "minutes", "kcal"]));
      download(`water-${stamp}.csv`, toCsv(d.water, ["logged_on", "amount_oz"]));
      download(`measurements-${stamp}.csv`, toCsv(d.measurements, ["measured_on", "kind", "value_in"]));
      setDone(
        `Downloaded 5 files: ${d.entries.length} foods, ${d.weighIns.length} weigh-ins, ${d.movement.length} activities, ${d.water.length} water entries, ${d.measurements.length} measurements.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-4 p-5" aria-labelledby="export-heading">
      <h2 id="export-heading" className="font-display text-lg font-semibold">
        Export my data
      </h2>
      <p className="mt-1 text-[13px] text-muted">Your food log, weigh-ins, movement, water and measurements as CSV files. Only your own data.</p>
      <button type="button" className="btn btn-quiet mt-3 w-full" onClick={() => void run()} disabled={busy}>
        {busy ? "Preparing…" : "Download CSVs"}
      </button>
      {done && (
        <p className="mt-2 text-[14px]" role="status">
          {done}
        </p>
      )}
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
    </section>
  );
}
