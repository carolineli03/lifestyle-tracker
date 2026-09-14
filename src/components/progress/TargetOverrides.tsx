"use client";

import { useState } from "react";
import type { Profile } from "@/lib/supabase/database.types";
import type { ProfilePatch } from "@/lib/progress";
import { isBelowFloor } from "@/lib/targets";
import { ErrorNote } from "@/components/ErrorNote";
import { Labelled } from "./TargetCalculator";

type Field = {
  key: keyof ProfilePatch;
  label: string;
  kind: "int" | "decimal" | "date";
};

const TARGETS: readonly Field[] = [
  { key: "kcal_target", label: "Calories (kcal)", kind: "int" },
  { key: "protein_target", label: "Protein (g)", kind: "int" },
  { key: "carb_target", label: "Carbs (g)", kind: "int" },
  { key: "fat_target", label: "Fat (g)", kind: "int" },
];

const GOALS: readonly Field[] = [
  { key: "start_weight", label: "Start weight (lb)", kind: "decimal" },
  { key: "start_date", label: "Start date", kind: "date" },
  { key: "goal_weight", label: "Goal weight (lb)", kind: "decimal" },
  { key: "goal_date", label: "Goal date", kind: "date" },
  { key: "weekly_movement_goal", label: "Weekly movement (min)", kind: "int" },
];

type Values = Record<string, string>;

function initial(profile: Profile | null): Values {
  const values: Values = {};
  for (const f of [...TARGETS, ...GOALS]) {
    const raw = profile?.[f.key as keyof Profile];
    values[f.key] = raw === null || raw === undefined ? "" : String(f.kind === "date" ? raw : Number(raw));
  }
  return values;
}

/**
 * Every number by hand. A calorie target under 1,200 gets one plain sentence
 * beside it and still saves — it's their call.
 */
export function TargetOverrides({
  profile,
  onSave,
}: {
  profile: Profile | null;
  onSave: (patch: ProfilePatch) => Promise<void>;
}) {
  const [values, setValues] = useState<Values>(() => initial(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const kcal = values.kcal_target ? Number(values.kcal_target) : null;

  function set(key: string, value: string): void {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const patch: Record<string, number | string | null> = {};
    for (const f of [...TARGETS, ...GOALS]) {
      const raw = (values[f.key] ?? "").trim();
      if (raw === "") {
        patch[f.key] = null;
        continue;
      }
      if (f.kind === "date") {
        patch[f.key] = raw;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setError(`${f.label} needs to be a number.`);
        return;
      }
      patch[f.key] = f.kind === "int" ? Math.round(n) : n;
    }

    if (patch.start_date && patch.goal_date && String(patch.goal_date) <= String(patch.start_date)) {
      setError("Goal date needs to be after the start date.");
      return;
    }

    setBusy(true);
    try {
      await onSave(patch as ProfilePatch);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-4 p-5" aria-labelledby="overrides-heading">
      <h2 id="overrides-heading" className="font-display text-lg font-semibold">
        Targets &amp; goals
      </h2>
      <p className="mt-1 text-[13px] text-muted">Set any of these by hand. Blank clears it.</p>

      <form onSubmit={submit} className="mt-4 grid gap-5">
        <div className="grid grid-cols-2 gap-3">
          {TARGETS.map((f) => (
            <div key={f.key} className={f.key === "kcal_target" ? "col-span-2" : undefined}>
              <Input field={f} value={values[f.key] ?? ""} onChange={set} />
              {f.key === "kcal_target" && isBelowFloor(kcal) && (
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--tomato)" }}>
                  Below 1,200 kcal a day it's hard to get enough protein and micronutrients.
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {GOALS.map((f) => (
            <div key={f.key} className={f.key === "weekly_movement_goal" ? "col-span-2" : undefined}>
              <Input field={f} value={values[f.key] ?? ""} onChange={set} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          {saved && (
            <span role="status" className="text-[14px] font-semibold" style={{ color: "var(--pine)" }}>
              Saved.
            </span>
          )}
        </div>
      </form>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
    </section>
  );
}

function Input({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <Labelled label={field.label}>
      <input
        className="field"
        type={field.kind === "date" ? "date" : "number"}
        inputMode={field.kind === "int" ? "numeric" : field.kind === "decimal" ? "decimal" : undefined}
        step={field.kind === "decimal" ? 0.1 : field.kind === "int" ? 1 : undefined}
        min={field.kind === "date" ? undefined : 0}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    </Labelled>
  );
}
