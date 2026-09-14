import Link from "next/link";
import { caloriesRemaining, isOver, progressFraction, type MacroTotals, type Targets } from "@/lib/totals";
import { adjustedTarget } from "@/lib/exercise";
import type { NutrientTotals } from "@/lib/nutrients";
import { Ring } from "@/components/ui/Ring";

export type NutrientGoals = { fiber: number | null; sugar: number | null; sodium: number | null };

/**
 * The glance: calories left as the one loud number, inside a ring, with the
 * three macros underneath. Everything else on Today is quieter than this.
 */
export function TodayHero({
  eaten,
  targets: baseTargets,
  exerciseKcal,
  eatBack,
  nutrients,
  nutrientGoals,
}: {
  eaten: MacroTotals;
  targets: Targets;
  exerciseKcal: number;
  eatBack: boolean;
  nutrients: NutrientTotals;
  nutrientGoals: NutrientGoals;
}) {
  const targets: Targets = { ...baseTargets, kcal: adjustedTarget(baseTargets.kcal, exerciseKcal, eatBack) };
  const remaining = caloriesRemaining(eaten.kcal, targets.kcal);
  const over = isOver(eaten.kcal, targets.kcal);
  const noTarget = remaining === null;
  const big = noTarget ? Math.round(eaten.kcal) : Math.abs(remaining);

  return (
    <section className="card px-4 pb-4 pt-5" aria-label="Today's calories">
      <div className="flex justify-center">
        <Ring
          size={208}
          stroke={16}
          fraction={noTarget ? 0 : progressFraction(eaten.kcal, targets.kcal)}
          over={over}
          label={
            noTarget
              ? `${big} calories eaten, no target set`
              : `${Math.round(eaten.kcal)} of ${targets.kcal} calories eaten, ${big} ${over ? "over" : "left"}`
          }
        >
          <div>
            <p className="font-display font-bold leading-none" style={{ fontSize: 60, letterSpacing: "-0.03em", color: over ? "var(--tomato)" : undefined }}>
              {big.toLocaleString()}
            </p>
            <p className="t-meta mt-1">{noTarget ? "kcal eaten" : over ? "kcal over" : "kcal left"}</p>
          </div>
        </Ring>
      </div>

      {noTarget ? (
        <p className="mt-2 text-center text-[14px] text-muted">
          <Link href="/settings/targets" className="font-semibold underline" style={{ color: "var(--pine)" }}>
            Set a daily target
          </Link>{" "}
          to see what&rsquo;s left.
        </p>
      ) : (
        <p className="t-meta mt-1 text-center">
          {Math.round(eaten.kcal).toLocaleString()} of {targets.kcal?.toLocaleString()} kcal
          {eatBack && exerciseKcal > 0 ? ` · includes +${Math.round(exerciseKcal)} exercise` : ""}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Macro name="Protein" eaten={eaten.protein_g} target={targets.protein} color="var(--pine)" />
        <Macro name="Carbs" eaten={eaten.carb_g} target={targets.carb} color="var(--marigold)" />
        <Macro name="Fat" eaten={eaten.fat_g} target={targets.fat} color="var(--muted)" />
      </div>

      <NutrientLine totals={nutrients} goals={nutrientGoals} />
    </section>
  );
}

function Macro({ name, eaten, target, color }: { name: string; eaten: number; target: number | null; color: string }) {
  const f = progressFraction(eaten, target);
  return (
    <div>
      <p className="t-meta">{name}</p>
      <p className="text-[15px] font-semibold">
        {Math.round(eaten)}
        <span className="t-meta font-normal">{target ? ` / ${target}g` : "g"}</span>
      </p>
      <div
        role="progressbar"
        aria-label={`${name}: ${Math.round(eaten)} of ${target ?? "no"} grams`}
        aria-valuenow={Math.round(f * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1 overflow-hidden rounded-pill"
        style={{ height: 5, background: "var(--line)" }}
      >
        <div style={{ width: `${f * 100}%`, height: "100%", background: isOver(eaten, target) ? "var(--tomato)" : color, transition: "width 200ms ease" }} />
      </div>
    </div>
  );
}

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
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px]">
        {items.map((i) => (
          <span key={i.label} style={i.limit && i.goal !== null && i.t.amount > i.goal ? { color: "var(--tomato)" } : undefined}>
            <span className="text-muted">{i.label}</span> <span className="font-semibold">{Math.round(i.t.amount).toLocaleString()}</span>
            <span className="text-muted">
              {i.limit ? " / max " : " / "}
              {i.goal?.toLocaleString()}
              {i.unit}
            </span>
          </span>
        ))}
      </p>
      {missing > 0 && <p className="t-meta mt-1 text-center">Some foods have no figure, so real totals are higher.</p>}
    </div>
  );
}
