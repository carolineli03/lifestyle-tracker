"use client";

import { useState } from "react";
import Link from "next/link";
import { postAi } from "@/lib/ai/client";
import { CookResponse, MEAL_TYPES, PrepPlanResponse, type MealIdea, type MealType, type PrepPlan } from "@/lib/ai/schemas";
import { todayIso } from "@/lib/date";
import { logEntry } from "@/lib/today";
import { ErrorNote } from "@/components/ErrorNote";

/**
 * Client-side because the ideas are for *today* — the phone's today. The
 * browser only sends that date; the server reads the kitchen and the day's
 * log itself.
 */
export function CookClient() {
  return (
    <>
      <Ideas />
      <PrepPlanner />
      <p className="mt-4 text-center text-[13px] text-muted">
        Ideas come from what&rsquo;s on the{" "}
        <Link href="/fridge" className="font-semibold underline" style={{ color: "var(--pine)" }}>
          Fridge tab
        </Link>
        , soonest use-by first.
      </p>
    </>
  );
}

const MEAL_LABEL: Record<MealType, string> = {
  any: "Any",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function Ideas() {
  const [meal, setMeal] = useState<MealType>("any");
  const [ideas, setIdeas] = useState<MealIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState<Record<number, "saving" | "done">>({});

  async function ask(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const { items } = await postAi("/api/cook", { date: todayIso(), meal }, CookResponse);
      if (items.length === 0) {
        setError("No ideas came back. Try a different meal type.");
        return;
      }
      setIdeas(items.slice(0, 3));
      setLogged({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't get ideas right now.");
    } finally {
      setLoading(false);
    }
  }

  async function log(index: number, idea: MealIdea): Promise<void> {
    setLogged((l) => ({ ...l, [index]: "saving" }));
    setError(null);
    try {
      // A one-off meal, not a staple: keep it out of the shared food library.
      await logEntry(
        todayIso(),
        idea.name,
        { kcal: idea.kcal, protein_g: idea.protein, carb_g: idea.carbs, fat_g: idea.fat },
        false,
      );
      setLogged((l) => ({ ...l, [index]: "done" }));
    } catch (cause) {
      setLogged((l) => {
        const next = { ...l };
        delete next[index];
        return next;
      });
      setError(cause instanceof Error ? cause.message : "That didn't log.");
    }
  }

  return (
    <section className="card p-5" aria-labelledby="ideas-heading">
      <h2 id="ideas-heading" className="font-display text-lg font-semibold">
        What can I make?
      </h2>

      <div role="radiogroup" aria-label="Meal type" className="mt-3 flex flex-wrap gap-2">
        {MEAL_TYPES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={meal === m}
            data-active={meal === m}
            className="chip"
            onClick={() => setMeal(m)}
            disabled={loading}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </div>

      <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => void ask()} disabled={loading}>
        {loading ? "Looking in the fridge…" : ideas.length ? "Three more ideas" : "Give me three ideas"}
      </button>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      <div aria-live="polite">
        {ideas.length > 0 && (
          <ul className="mt-4 grid gap-3">
            {ideas.map((idea, i) => (
              <li key={`${idea.name}-${i}`} className="rounded-field p-4" style={{ border: "1px solid var(--line)" }}>
                <h3 className="font-display text-[17px] font-semibold leading-snug">{idea.name}</h3>
                <p className="mt-1 text-[13px] text-muted">
                  <span className="font-semibold text-ink">{Math.round(idea.kcal)} kcal</span> · {Math.round(idea.protein)}g
                  protein · {Math.round(idea.carbs)}g carbs · {Math.round(idea.fat)}g fat · {idea.minutes} min
                </p>
                <p className="mt-2 text-[14px] leading-relaxed">{idea.method}</p>
                {idea.uses.length > 0 && <Uses items={idea.uses} />}
                <button
                  type="button"
                  className={`btn mt-3 w-full ${logged[i] === "done" ? "btn-quiet" : "btn-primary"}`}
                  onClick={() => void log(i, idea)}
                  disabled={logged[i] !== undefined}
                >
                  {logged[i] === "done" ? "Logged to today ✓" : logged[i] === "saving" ? "Logging…" : "Log this"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PrepPlanner() {
  const [servings, setServings] = useState(5);
  const [plan, setPlan] = useState<PrepPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const result = await postAi("/api/prep-plan", { date: todayIso(), servings }, PrepPlanResponse);
      if (result.components.length === 0) {
        setError("No plan came back. Add a few more things to the kitchen and try again.");
        return;
      }
      setPlan(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't make a plan right now.");
    } finally {
      setLoading(false);
    }
  }

  const perLunch = plan?.components.reduce(
    (t, c) => ({
      kcal: t.kcal + c.per_portion.kcal,
      protein: t.protein + c.per_portion.protein,
    }),
    { kcal: 0, protein: 0 },
  );

  return (
    <section className="card mt-4 p-5" aria-labelledby="prep-heading">
      <h2 id="prep-heading" className="font-display text-lg font-semibold">
        Sunday prep
      </h2>
      <p className="mt-1 text-[13px] text-muted">Two or three components that mix into a week of lunches.</p>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-[14px] font-semibold text-muted" id="servings-label">
          Lunches
        </span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="servings-label">
          <button
            type="button"
            className="btn btn-quiet"
            style={{ width: 44, padding: 0 }}
            aria-label="Fewer lunches"
            onClick={() => setServings((s) => Math.max(2, s - 1))}
            disabled={loading || servings <= 2}
          >
            −
          </button>
          <output className="w-8 text-center font-display text-xl font-bold" aria-live="polite">
            {servings}
          </output>
          <button
            type="button"
            className="btn btn-quiet"
            style={{ width: 44, padding: 0 }}
            aria-label="More lunches"
            onClick={() => setServings((s) => Math.min(10, s + 1))}
            disabled={loading || servings >= 10}
          >
            +
          </button>
        </div>
      </div>

      <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => void ask()} disabled={loading}>
        {loading ? "Planning…" : `Plan ${servings} lunches`}
      </button>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      <div aria-live="polite">
        {plan && perLunch && (
          <div className="mt-4">
            <p className="text-[13px] text-muted">
              Each assembled lunch ≈{" "}
              <span className="font-semibold text-ink">{Math.round(perLunch.kcal)} kcal</span> ·{" "}
              {Math.round(perLunch.protein)}g protein
            </p>
            <ul className="mt-3 grid gap-3">
              {plan.components.map((c, i) => (
                <li key={`${c.name}-${i}`} className="rounded-field p-4" style={{ border: "1px solid var(--line)" }}>
                  <h3 className="font-display text-[17px] font-semibold">{c.name}</h3>
                  <p className="mt-1 text-[13px] text-muted">
                    Per lunch: {Math.round(c.per_portion.kcal)} kcal · {Math.round(c.per_portion.protein)}p ·{" "}
                    {Math.round(c.per_portion.carbs)}c · {Math.round(c.per_portion.fat)}f
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed">{c.method}</p>
                  <dl className="mt-2 grid gap-1 text-[13px]">
                    <div>
                      <dt className="inline font-semibold">Storage: </dt>
                      <dd className="inline">{c.storage}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">Reheat: </dt>
                      <dd className="inline">{c.reheat}</dd>
                    </div>
                  </dl>
                  {c.uses.length > 0 && <Uses items={c.uses} />}
                </li>
              ))}
            </ul>
            {plan.assembly.length > 0 && (
              <>
                <h3 className="mt-4 text-[13px] font-semibold text-muted">Putting lunches together</h3>
                <ol className="mt-1 grid list-decimal gap-1 pl-5 text-[14px]">
                  {plan.assembly.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Uses({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Uses from your kitchen">
      {items.map((u) => (
        <li
          key={u}
          className="rounded-pill px-2.5 py-0.5 text-[12px] font-semibold"
          style={{ background: "var(--pine-wash)", color: "var(--pine)" }}
        >
          {u}
        </li>
      ))}
    </ul>
  );
}
