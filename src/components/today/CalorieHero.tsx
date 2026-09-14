"use client";

import Link from "next/link";
import { caloriesRemaining, isOver, progressFraction, type MacroTotals, type Targets } from "@/lib/totals";
import { adjustedTarget } from "@/lib/exercise";
import type { NutrientTotals } from "@/lib/nutrients";

export type NutrientGoals = { fiber: number | null; sugar: number | null; sodium: number | null };

/**
 * The one place the design is allowed to shout: a 68px figure, and everything
 * around it kept quiet.
 */
export function CalorieHero({
  eaten,
  targets: baseTargets,
  exerciseKcal = 0,
  eatBack = false,
  nutrients,
  nutrientGoals,
  streak = 0,
}: {
  eaten: MacroTotals;
  targets: Targets;
  exerciseKcal?: number;
  eatBack?: boolean;
  nutrients?: NutrientTotals;
  nutrientGoals?: NutrientGoals;
  streak?: number;
}) {
  const targets: Targets = { ...baseTargets, kcal: adjustedTarget(baseTargets.kcal, exerciseKcal, eatBack) };
  const remaining = caloriesRemaining(eaten.kcal, targets.kcal);
  const over = isOver(eaten.kcal, targets.kcal);
  const streakPill =
    streak >= 2 ? (
      <span className="rounded-pill px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: "var(--marigold-wash)", color: "var(--ink)" }}>
        {streak}-day streak
      </span>
    ) : null;

  if (remaining === null) {
    return (
      <section className="card p-5" aria-labelledby="hero-label">
        <div className="flex items-center justify-between">
          <p id="hero-label" className="text-[13px] font-semibold text-muted">
            Calories eaten
          </p>
          {streakPill}
        </div>
        <p className="font-display font-bold text-hero">{Math.round(eaten.kcal).toLocaleString()}</p>
        <p className="mt-2 text-[14px] text-muted">
          No target set yet.{" "}
          <Link href="/progress" className="font-semibold underline" style={{ color: "var(--pine)" }}>
            Work one out on Progress
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5" aria-labelledby="hero-label">
      <div className="flex items-center justify-between">
        <p id="hero-label" className="text-[13px] font-semibold text-muted">
          {over ? "Calories over" : "Calories remaining"}
        </p>
        {streakPill}
      </div>
      <p
        className="font-display font-bold text-hero"
        style={over ? { color: "var(--tomato)" } : undefined}
      >
        {Math.abs(remaining).toLocaleString()}
      </p>

      <Bar
        label={`${Math.round(eaten.kcal).toLocaleString()} of ${targets.kcal?.toLocaleString()} kcal`}
        fraction={progressFraction(eaten.kcal, targets.kcal)}
        color={over ? "var(--tomato)" : "var(--pine)"}
        thick
      />
      {eatBack && exerciseKcal > 0 && (
        <p className="mt-1.5 text-[12px] text-muted">
          Target {baseTargets.kcal?.toLocaleString()} + {Math.round(exerciseKcal).toLocaleString()} from exercise
        </p>
      )}

      <div className="mt-4 grid gap-3">
        <MacroBar name="Protein" eaten={eaten.protein_g} target={targets.protein} color="var(--pine)" />
        <MacroBar name="Carbs" eaten={eaten.carb_g} target={targets.carb} color="var(--marigold)" />
        <MacroBar name="Fat" eaten={eaten.fat_g} target={targets.fat} color="var(--muted)" />
      </div>

      {nutrients && nutrientGoals && <NutrientLine totals={nutrients} goals={nutrientGoals} />}
    </section>
  );
}

function MacroBar({
  name,
  eaten,
  target,
  color,
}: {
  name: string;
  eaten: number;
  target: number | null;
  color: string;
}) {
  const rounded = Math.round(eaten);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <span className="font-semibold text-muted">{name}</span>
        <span className="text-muted">
          <span className="text-ink">{rounded}</span>
          {target ? ` / ${target} g` : " g"}
        </span>
      </div>
      <Bar
        label={`${name}: ${rounded} of ${target ?? "no"} grams`}
        fraction={progressFraction(eaten, target)}
        color={isOver(eaten, target) ? "var(--tomato)" : color}
      />
    </div>
  );
}

function Bar({
  label,
  fraction,
  color,
  thick = false,
}: {
  label: string;
  fraction: number;
  color: string;
  thick?: boolean;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={thick ? "mt-3 overflow-hidden rounded-pill" : "overflow-hidden rounded-pill"}
      style={{ height: thick ? 10 : 4, background: "var(--line)" }}
    >
      <div
        style={{
          width: `${fraction * 100}%`,
          height: "100%",
          background: color,
          transition: "width 200ms ease",
        }}
      />
    </div>
  );
}

/** Fiber toward a target; sugar and sodium against limits. Only shown once one of them is set. */
function NutrientLine({ totals, goals }: { totals: NutrientTotals; goals: NutrientGoals }) {
  const items = [
    { label: "Fiber", t: totals.fiber_g, goal: goals.fiber, unit: "g", limit: false },
    { label: "Sugar", t: totals.sugar_g, goal: goals.sugar, unit: "g", limit: true },
    { label: "Sodium", t: totals.sodium_mg, goal: goals.sodium, unit: "mg", limit: true },
  ].filter((i) => i.goal !== null);
  if (items.length === 0) return null;
  const missing = Math.max(...items.map((i) => i.t.missing));

  return (
    <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--line)" }}>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {items.map((i) => {
          const overLimit = i.limit && i.goal !== null && i.t.amount > i.goal;
          return (
            <span key={i.label} style={overLimit ? { color: "var(--tomato)" } : undefined}>
              <span className="font-semibold text-muted">{i.label}</span>{" "}
              {Math.round(i.t.amount).toLocaleString()}
              <span className="text-muted">
                {" "}
                {i.limit ? "of max" : "/"} {i.goal?.toLocaleString()} {i.unit}
              </span>
            </span>
          );
        })}
      </p>
      {missing > 0 && (
        <p className="mt-1 text-[12px] text-muted">
          {missing} {missing === 1 ? "food has" : "foods have"} no figure for some of these, so the real totals are higher.
        </p>
      )}
    </div>
  );
}
