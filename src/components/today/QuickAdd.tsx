"use client";

import { useState } from "react";
import type { MacroTotals } from "@/lib/totals";

/** Calories (and macros if you know them) without naming a food. Logs straight away. */
export function QuickAdd({ onAdd, busy }: { onAdd: (macros: MacroTotals) => Promise<void>; busy: boolean }) {
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [done, setDone] = useState(false);

  const n = (v: string) => (v.trim() ? Math.max(0, Number(v)) : 0);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setDone(false);
    await onAdd({ kcal: Math.round(n(kcal)), protein_g: n(protein), carb_g: n(carbs), fat_g: n(fat) });
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
    setDone(true);
  }

  return (
    <form className="mt-4" onSubmit={(e) => void submit(e).catch(() => undefined)}>
      <label className="grid grid-cols-1 gap-1.5">
        <span className="text-[13px] font-semibold text-muted">Calories</span>
        <input className="field" type="number" inputMode="numeric" min={1} required value={kcal} onChange={(e) => setKcal(e.target.value)} />
      </label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(
          [
            ["Protein (g)", protein, setProtein],
            ["Carbs (g)", carbs, setCarbs],
            ["Fat (g)", fat, setFat],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="grid grid-cols-1 gap-1">
            <span className="text-[11px] font-semibold text-muted">{label}</span>
            <input className="field px-2" type="number" inputMode="decimal" min={0} placeholder="optional" value={value} onChange={(e) => set(e.target.value)} />
          </label>
        ))}
      </div>
      <button type="submit" className="btn btn-primary mt-3 w-full" disabled={busy || !kcal.trim()}>
        {busy ? "Adding…" : "Quick add"}
      </button>
      {done && (
        <p className="mt-2 text-[14px] font-semibold" style={{ color: "var(--pine)" }} role="status">
          Added.
        </p>
      )}
    </form>
  );
}
