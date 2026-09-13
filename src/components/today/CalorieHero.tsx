"use client";

import Link from "next/link";
import { caloriesRemaining, isOver, progressFraction, type MacroTotals, type Targets } from "@/lib/totals";

/**
 * The one place the design is allowed to shout: a 68px figure, and everything
 * around it kept quiet.
 */
export function CalorieHero({ eaten, targets }: { eaten: MacroTotals; targets: Targets }) {
  const remaining = caloriesRemaining(eaten.kcal, targets.kcal);
  const over = isOver(eaten.kcal, targets.kcal);

  if (remaining === null) {
    return (
      <section className="card p-5" aria-labelledby="hero-label">
        <p id="hero-label" className="text-[13px] font-semibold text-muted">
          Calories eaten
        </p>
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
      <p id="hero-label" className="text-[13px] font-semibold text-muted">
        {over ? "Calories over" : "Calories remaining"}
      </p>
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

      <div className="mt-4 grid gap-3">
        <MacroBar name="Protein" eaten={eaten.protein_g} target={targets.protein} color="var(--pine)" />
        <MacroBar name="Carbs" eaten={eaten.carb_g} target={targets.carb} color="var(--marigold)" />
        <MacroBar name="Fat" eaten={eaten.fat_g} target={targets.fat} color="var(--muted)" />
      </div>
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
