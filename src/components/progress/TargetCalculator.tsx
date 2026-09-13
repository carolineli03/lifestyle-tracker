"use client";

import { useState } from "react";
import type { Profile, SexAtBirth } from "@/lib/supabase/database.types";
import {
  ACTIVITY_LEVELS,
  computeTargets,
  fromInches,
  KCAL_PER_LB_PER_WEEK,
  RATE_OPTIONS,
  toInches,
  type TargetInputs,
  type TargetResult,
} from "@/lib/targets";
import type { ProfilePatch } from "@/lib/progress";
import { todayIso } from "@/lib/date";
import { ErrorNote } from "@/components/ErrorNote";

/**
 * Two steps on purpose: Calculate shows the number and the reasoning, Save
 * writes it. Nothing reaches the profile until the second tap.
 */
export function TargetCalculator({
  profile,
  latestWeight,
  onSave,
}: {
  profile: Profile | null;
  latestWeight: number | null;
  onSave: (patch: ProfilePatch) => Promise<void>;
}) {
  const height = profile?.height_inches ? fromInches(Number(profile.height_inches)) : null;

  const [sex, setSex] = useState<SexAtBirth | null>(profile?.sex_at_birth ?? null);
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [feet, setFeet] = useState(height ? String(height.feet) : "");
  const [inches, setInches] = useState(height ? String(height.inches) : "");
  const [weight, setWeight] = useState(() => {
    const w = latestWeight ?? (profile?.start_weight ? Number(profile.start_weight) : null);
    return w ? String(w) : "";
  });
  const [activity, setActivity] = useState(
    profile?.activity_factor ? String(Number(profile.activity_factor)) : "1.375",
  );
  const [rate, setRate] = useState(
    profile?.target_rate_lb_week ? Number(profile.target_rate_lb_week) : 1,
  );

  const [result, setResult] = useState<{ input: TargetInputs; out: TargetResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Any edit after calculating hides the old result, so the number on screen
  // is always the number that Save would write.
  function edit<T>(setter: (v: T) => void): (v: T) => void {
    return (v) => {
      setter(v);
      setResult(null);
      setSaved(false);
    };
  }

  function calculate(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const a = Number(age);
    const ft = Number(feet);
    const inch = inches === "" ? 0 : Number(inches);
    const lb = Number(weight);
    const heightIn = toInches(ft, inch);

    if (!sex) return setError("Pick sex at birth — the formula differs by 166 kcal between the two.");
    if (!Number.isFinite(a) || a < 13 || a > 120) return setError("Age needs to be between 13 and 120.");
    if (!Number.isFinite(ft) || !Number.isFinite(inch) || heightIn < 36 || heightIn > 96)
      return setError("Height needs to be between 3 ft and 8 ft.");
    if (!Number.isFinite(lb) || lb < 50 || lb > 800) return setError("Enter your current weight in pounds.");

    const input: TargetInputs = { sex, age: a, heightIn, weightLb: lb, activity: Number(activity), rateLbWeek: rate };
    setResult({ input, out: computeTargets(input) });
  }

  async function save(): Promise<void> {
    if (!result) return;
    const { input, out } = result;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        sex_at_birth: input.sex,
        age: input.age,
        height_inches: input.heightIn,
        activity_factor: input.activity,
        target_rate_lb_week: input.rateLbWeek,
        kcal_target: out.kcal,
        protein_target: out.protein,
        carb_target: out.carbs,
        fat_target: out.fat,
        // First calculation also marks where the journey starts, unless a
        // start was already set by hand.
        ...(profile?.start_weight == null ? { start_weight: input.weightLb } : {}),
        ...(profile?.start_date == null ? { start_date: todayIso() } : {}),
      });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-4 p-5" aria-labelledby="calc-heading">
      <h2 id="calc-heading" className="font-display text-lg font-semibold">
        Target calculator
      </h2>
      <p className="mt-1 text-[13px] text-muted">Works out a daily calorie and macro target. Nothing saves until you say so.</p>

      <form onSubmit={calculate} className="mt-4 grid gap-4">
        <Fieldset legend="Sex at birth">
          {(["female", "male"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={sex === s}
              style={{ minHeight: 44 }}
              onClick={() => edit(setSex)(s)}
            >
              {s === "female" ? "Female" : "Male"}
            </button>
          ))}
        </Fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Age">
            <input className="field" type="number" inputMode="numeric" min={13} max={120} value={age} onChange={(e) => edit(setAge)(e.target.value)} />
          </Labelled>
          <Labelled label="Weight (lb)">
            <input className="field" type="number" inputMode="decimal" step={0.1} value={weight} onChange={(e) => edit(setWeight)(e.target.value)} />
          </Labelled>
          <Labelled label="Height (ft)">
            <input className="field" type="number" inputMode="numeric" min={3} max={8} value={feet} onChange={(e) => edit(setFeet)(e.target.value)} />
          </Labelled>
          <Labelled label="Height (in)">
            <input className="field" type="number" inputMode="decimal" min={0} max={11.9} step={0.5} value={inches} onChange={(e) => edit(setInches)(e.target.value)} />
          </Labelled>
        </div>

        <Labelled label="Activity level">
          <select className="field" value={activity} onChange={(e) => edit(setActivity)(e.target.value)}>
            {ACTIVITY_LEVELS.map((l) => (
              <option key={l.factor} value={String(l.factor)}>
                {l.label} ({l.factor}) — {l.hint}
              </option>
            ))}
          </select>
        </Labelled>

        <Fieldset legend="Aim to lose">
          {RATE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className="chip"
              aria-pressed={rate === r}
              style={{ minHeight: 44 }}
              onClick={() => edit(setRate)(r)}
            >
              {r} lb / week
            </button>
          ))}
        </Fieldset>

        <button type="submit" className="btn btn-quiet">
          Calculate
        </button>
      </form>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {result && <Result input={result.input} out={result.out} busy={busy} saved={saved} onSave={() => void save()} />}
    </section>
  );
}

function Result({
  input,
  out,
  busy,
  saved,
  onSave,
}: {
  input: TargetInputs;
  out: TargetResult;
  busy: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  const floorName = out.floor > 1200 ? "your BMR" : "1,200 kcal";

  return (
    <div className="mt-5 rounded-field p-4" style={{ background: "var(--pine-wash)" }} aria-live="polite">
      <p className="text-[13px] font-semibold text-muted">Daily target</p>
      <p className="font-display text-[40px] font-bold leading-none">
        {out.kcal.toLocaleString()} <span className="font-sans text-[15px] font-semibold text-muted">kcal</span>
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Macro label="Protein" grams={out.protein} />
        <Macro label="Carbs" grams={out.carbs} />
        <Macro label="Fat" grams={out.fat} />
      </dl>

      <div className="mt-4 grid gap-2 text-[14px] leading-relaxed">
        <p>
          Your body burns about <strong>{out.bmr.toLocaleString()}</strong> kcal at rest (Mifflin-St Jeor). At activity{" "}
          {input.activity} that's <strong>{out.tdee.toLocaleString()}</strong> to maintain your weight.
        </p>

        {out.clamped ? (
          <p style={{ color: "var(--tomato)" }}>
            {input.rateLbWeek} lb a week would mean {out.requestedKcal.toLocaleString()} kcal, which is below the floor of{" "}
            {floorName} ({out.floor.toLocaleString()}), so the target is set at {out.kcal.toLocaleString()}.{" "}
            {out.actualRateLbWeek > 0
              ? `That works out to about ${out.actualRateLbWeek.toFixed(1)} lb a week, not ${input.rateLbWeek}.`
              : "At this activity level that is at or above maintenance, so it won't produce weight loss — more activity is what changes that."}
          </p>
        ) : (
          <p>
            Minus {KCAL_PER_LB_PER_WEEK} kcal a day for each pound a week: {out.tdee.toLocaleString()} −{" "}
            {(KCAL_PER_LB_PER_WEEK * input.rateLbWeek).toLocaleString()} = {out.kcal.toLocaleString()}.
          </p>
        )}

        <p className="text-muted">
          Protein is set high — 0.8 g per lb of body weight
          {out.proteinCapped ? ", capped here at 40% of calories" : ""} — to protect muscle while you're eating in a
          deficit. Fat is 27% of calories; carbs fill the rest.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onSave}>
          {busy ? "Saving…" : "Save these targets"}
        </button>
        {saved && (
          <span role="status" className="text-[14px] font-semibold" style={{ color: "var(--pine)" }}>
            Saved — Today now uses these.
          </span>
        )}
      </div>
    </div>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="rounded-field bg-card px-2 py-2">
      <dt className="text-[12px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 font-display text-[20px] font-bold">
        {grams}
        <span className="font-sans text-[12px] text-muted">g</span>
      </dd>
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1.5 text-[13px] font-semibold text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
