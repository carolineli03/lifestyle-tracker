"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { postAi } from "@/lib/ai/client";
import { CookResponse, MEAL_TYPES, PrepPlanResponse, type MealIdea, type MealType, type PrepPlan } from "@/lib/ai/schemas";
import { todayIso } from "@/lib/date";
import { logEntry } from "@/lib/today";
import { defaultMeal } from "@/lib/meals";
import { ErrorNote } from "@/components/ErrorNote";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/icons";
import { WeekPlanner } from "@/components/cook/WeekPlanner";
import { RecipeBook } from "@/components/cook/RecipeBook";
import { addRecipe, fetchRecipes, type NewRecipe } from "@/lib/planner-data";
import type { Recipe } from "@/lib/supabase/database.types";

/**
 * Client-side because the ideas are for *today* — the phone's today. The
 * browser only sends that date; the server reads the kitchen and the day's
 * log itself.
 */
type Section = "ideas" | "plan" | "recipes";

const SECTIONS: ReadonlyArray<{ value: Section; label: React.ReactNode }> = [
  { value: "ideas", label: "Ideas" },
  { value: "plan", label: "Plan" },
  { value: "recipes", label: "Recipes" },
];

type SaveRecipe = (recipe: NewRecipe) => Promise<void>;

export function CookClient({ householdId, userId }: { householdId: string; userId: string }) {
  const [section, setSection] = useState<Section>("ideas");
  const [prepOpen, setPrepOpen] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  const loadRecipes = useCallback(async () => {
    setRecipes(await fetchRecipes());
  }, []);

  useEffect(() => {
    loadRecipes().catch((cause: unknown) =>
      setRecipeError(cause instanceof Error ? cause.message : "Could not load recipes."),
    );
  }, [loadRecipes]);

  const saveRecipe: SaveRecipe = async (recipe) => {
    await addRecipe(householdId, userId, recipe);
    await loadRecipes();
  };

  return (
    <>
      <Segmented label="Cook" value={section} onChange={setSection} options={SECTIONS} />

      {recipeError && <ErrorNote message={recipeError} onDismiss={() => setRecipeError(null)} />}

      {section === "ideas" && (
        <>
          <Ideas onSave={saveRecipe} savedNames={recipes.map((r) => r.name)} />

          <button type="button" className="list mt-3 w-full text-left" onClick={() => setPrepOpen(true)}>
            <span className="list-row">
              <span className="list-row-lead" aria-hidden="true">
                <Icon name="calendar" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Sunday prep</span>
                <span className="t-meta block">Batch a week of lunches from what you have</span>
              </span>
              <Icon name="chevron-right" size={18} className="text-muted" />
            </span>
          </button>

          <p className="t-meta mt-4 text-center">
            Ideas use what&rsquo;s in the{" "}
            <Link href="/fridge" className="font-semibold underline" style={{ color: "var(--pine)" }}>
              Kitchen
            </Link>
            , soonest use-by first.
          </p>

          <Sheet open={prepOpen} onClose={() => setPrepOpen(false)} title="Sunday prep">
            <div className="in-sheet">
              <PrepPlanner onSave={saveRecipe} savedNames={recipes.map((r) => r.name)} />
            </div>
          </Sheet>
        </>
      )}
      {section === "plan" && (
        <WeekPlanner
          householdId={householdId}
          userId={userId}
          recipes={recipes}
          onGoToRecipes={() => setSection("recipes")}
        />
      )}
      {section === "recipes" && (
        <RecipeBook householdId={householdId} userId={userId} recipes={recipes} onChanged={loadRecipes} />
      )}
    </>
  );
}

/** "Save recipe" → "Saved ✓", or the reason it couldn't be. */
function SaveButton({ saved, onSave }: { saved: boolean; onSave: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="btn btn-quiet w-full"
        disabled={saved || state === "saving"}
        onClick={() => {
          setState("saving");
          setMessage(null);
          onSave()
            .then(() => setState("idle"))
            .catch((cause: unknown) => {
              setState("error");
              setMessage(cause instanceof Error ? cause.message : "That didn't save.");
            });
        }}
      >
        {saved ? "Saved ✓" : state === "saving" ? "Saving…" : "Save recipe"}
      </button>
      {message && (
        <p className="mt-1 text-[13px]" style={{ color: "var(--tomato)" }} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

function isSaved(name: string, savedNames: readonly string[]): boolean {
  const key = name.trim().toLowerCase();
  return savedNames.some((n) => n.trim().toLowerCase() === key);
}

const MEAL_LABEL: Record<MealType, string> = {
  any: "Any",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function Ideas({ onSave, savedNames }: { onSave: SaveRecipe; savedNames: readonly string[] }) {
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
      await logEntry(todayIso(), {
        name: idea.name,
        macros: { kcal: idea.kcal, protein_g: idea.protein, carb_g: idea.carbs, fat_g: idea.fat },
        // The chip picked when asking, or the meal the clock suggests for "Any".
        meal: meal === "any" ? defaultMeal() : meal,
        remember: false,
      });
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
    <section className="card mt-3 p-4" aria-labelledby="ideas-heading">
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
          <ul className="mt-4 grid grid-cols-1 gap-3">
            {ideas.map((idea, i) => (
              <li key={`${idea.name}-${i}`} className="rounded-field p-3.5" style={{ border: "1px solid var(--line)" }}>
                <h3 className="font-display text-[17px] font-semibold leading-snug">{idea.name}</h3>
                <p className="mt-1 text-[13px] text-muted">
                  <span className="font-semibold text-ink">{Math.round(idea.kcal)} kcal</span> · {Math.round(idea.protein)}g
                  protein · {Math.round(idea.carbs)}g carbs · {Math.round(idea.fat)}g fat · {idea.minutes} min
                </p>
                {idea.uses.length > 0 && <Uses items={idea.uses} />}
                <Method text={idea.method} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`btn ${logged[i] === "done" ? "btn-quiet" : "btn-primary"}`}
                  onClick={() => void log(i, idea)}
                  disabled={logged[i] !== undefined}
                >
                  {logged[i] === "done" ? "Logged ✓" : logged[i] === "saving" ? "Logging…" : "Log this"}
                </button>
                <SaveButton
                  saved={isSaved(idea.name, savedNames)}
                  onSave={() =>
                    onSave({
                      name: idea.name,
                      servings: 1,
                      ingredients: idea.ingredients,
                      method: idea.method,
                      kcal: idea.kcal,
                      protein_g: idea.protein,
                      carb_g: idea.carbs,
                      fat_g: idea.fat,
                      source: "idea",
                    })
                  }
                />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PrepPlanner({ onSave, savedNames }: { onSave: SaveRecipe; savedNames: readonly string[] }) {
  const [servings, setServings] = useState(5);
  // The count the current plan was made for; the stepper can move after.
  const [planServings, setPlanServings] = useState(5);
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
      setPlanServings(servings);
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
            <ul className="mt-3 grid grid-cols-1 gap-3">
              {plan.components.map((c, i) => (
                <li key={`${c.name}-${i}`} className="rounded-field p-4" style={{ border: "1px solid var(--line)" }}>
                  <h3 className="font-display text-[17px] font-semibold">{c.name}</h3>
                  <p className="mt-1 text-[13px] text-muted">
                    Per lunch: {Math.round(c.per_portion.kcal)} kcal · {Math.round(c.per_portion.protein)}p ·{" "}
                    {Math.round(c.per_portion.carbs)}c · {Math.round(c.per_portion.fat)}f
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed">{c.method}</p>
                  <dl className="mt-2 grid grid-cols-1 gap-1 text-[13px]">
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
                  <SaveButton
                    saved={isSaved(c.name, savedNames)}
                    onSave={() =>
                      onSave({
                        name: c.name,
                        servings: planServings,
                        ingredients: c.ingredients,
                        method: [c.method, `Storage: ${c.storage}`, `Reheat: ${c.reheat}`].join("\n"),
                        kcal: c.per_portion.kcal,
                        protein_g: c.per_portion.protein,
                        carb_g: c.per_portion.carbs,
                        fat_g: c.per_portion.fat,
                        source: "idea",
                      })
                    }
                  />
                </li>
              ))}
            </ul>
            {plan.assembly.length > 0 && (
              <>
                <h3 className="mt-4 text-[13px] font-semibold text-muted">Putting lunches together</h3>
                <ol className="mt-1 grid grid-cols-1 list-decimal gap-1 pl-5 text-[14px]">
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

/** The method, two lines until asked for more. */
function Method({ text }: { text: string }) {
  const [full, setFull] = useState(false);
  const long = text.length > 110;
  return (
    <p className="mt-2 text-[14px] leading-relaxed">
      <span className={full || !long ? undefined : "line-clamp-2"} style={{ display: full || !long ? undefined : "-webkit-box" }}>
        {text}
      </span>
      {long && (
        <button type="button" className="t-meta font-semibold underline" style={{ minHeight: 0 }} onClick={() => setFull(!full)} aria-expanded={full}>
          {full ? "Less" : "More"}
        </button>
      )}
    </p>
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
