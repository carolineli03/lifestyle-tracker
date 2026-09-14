"use client";

import { useCallback, useEffect, useState } from "react";
import type { MealPlanEntry, MealSlot, Recipe } from "@/lib/supabase/database.types";
import { addDays, fromIsoDate, todayIso, weekBounds, type IsoDate } from "@/lib/date";
import {
  MEAL_LABEL,
  MEAL_SLOTS,
  isCooked,
  leftoverCandidates,
  portionsToMake,
  rowsForDay,
  scaleNote,
  weekDays,
  weekSummary,
} from "@/lib/planner";
import * as data from "@/lib/planner-data";
import { ErrorNote } from "@/components/ErrorNote";

function shortDay(iso: IsoDate): string {
  return fromIsoDate(iso).toLocaleDateString(undefined, { weekday: "short" });
}

function dayHeading(iso: IsoDate, today: IsoDate): string {
  const d = fromIsoDate(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  return iso === today ? `Today · ${d}` : d;
}

/**
 * The week, Monday first. Pick a day, a meal and a recipe; say how many people
 * are eating; tick later meals to make extra for. Each cooked meal says how
 * many portions to make.
 */
export function WeekPlanner({
  householdId,
  userId,
  recipes,
  onGoToRecipes,
}: {
  householdId: string;
  userId: string;
  recipes: readonly Recipe[];
  onGoToRecipes: () => void;
}) {
  const [today] = useState(() => todayIso());
  const [weekOf, setWeekOf] = useState<IsoDate>(today);
  const [rows, setRows] = useState<MealPlanEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<IsoDate | null>(null);
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const days = weekDays(weekOf);
  const { start, end } = weekBounds(weekOf);

  const load = useCallback(async () => {
    setRows(await data.fetchPlan(start, end));
  }, [start, end]);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    data
      .fetchPlan(start, end)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load the plan.");
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  async function run(fn: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const all = rows ?? [];
  const summary = weekSummary(all, days);

  return (
    <>
      <section className="card mt-4 p-5" aria-labelledby="plan-heading">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="btn btn-quiet"
            style={{ width: 44, padding: 0 }}
            aria-label="Previous week"
            onClick={() => setWeekOf(addDays(start, -7))}
          >
            ‹
          </button>
          <div className="text-center">
            <h2 id="plan-heading" className="font-display text-lg font-semibold">
              {start <= today && today <= end
                ? "This week"
                : start === addDays(weekBounds(today).start, 7)
                  ? "Next week"
                  : start === addDays(weekBounds(today).start, -7)
                    ? "Last week"
                    : `Week of ${fromIsoDate(start).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
            </h2>
            <p className="text-[13px] text-muted">
              {fromIsoDate(start).toLocaleDateString(undefined, { day: "numeric", month: "short" })} –{" "}
              {fromIsoDate(end).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-quiet"
            style={{ width: 44, padding: 0 }}
            aria-label="Next week"
            onClick={() => setWeekOf(addDays(start, 7))}
          >
            ›
          </button>
        </div>

        <p className="mt-3 text-center text-[14px]" aria-live="polite">
          {rows === null
            ? "Loading…"
            : summary.cookingDays === 0 && summary.leftoverMeals === 0
              ? "Nothing planned yet."
              : `Cooking ${summary.cookingDays} ${summary.cookingDays === 1 ? "day" : "days"} · ${summary.portions} portions · ${summary.leftoverMeals} ${summary.leftoverMeals === 1 ? "meal" : "meals"} from leftovers`}
        </p>

        {recipes.length === 0 && (
          <p className="mt-3 rounded-field p-3 text-[14px]" style={{ background: "var(--marigold-wash)" }}>
            Plans are built from saved recipes.{" "}
            <button type="button" className="font-semibold underline" style={{ color: "var(--pine)", minHeight: 0 }} onClick={onGoToRecipes}>
              Add a recipe first
            </button>
            .
          </p>
        )}
      </section>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      <ol className="mt-4 grid gap-3">
        {days.map((day) => {
          const dayRows = rowsForDay(all, day);
          const taken = new Set(dayRows.map((r) => r.meal));
          return (
            <li key={day} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[16px] font-semibold">{dayHeading(day, today)}</h3>
                {recipes.length > 0 && taken.size < MEAL_SLOTS.length && adding !== day && (
                  <button type="button" className="chip" onClick={() => setAdding(day)} disabled={busy}>
                    + Add
                  </button>
                )}
              </div>

              {dayRows.length === 0 && adding !== day && <p className="mt-1 text-[13px] text-muted">No cooking planned.</p>}

              <ul className="mt-2 grid gap-2">
                {dayRows.map((row) => {
                  const recipe = recipeById.get(row.recipe_id);
                  const recipeName = recipe?.name ?? "Recipe";
                  if (!isCooked(row)) {
                    const source = all.find((r) => r.id === row.leftovers_from);
                    return (
                      <li key={row.id} className="rounded-field p-3" style={{ background: "var(--marigold-wash)" }}>
                        <p className="text-[13px] font-semibold text-muted">{MEAL_LABEL[row.meal]} · leftovers</p>
                        <p className="text-[15px] font-semibold">{recipeName}</p>
                        <p className="text-[13px] text-muted">
                          From {source ? `${shortDay(source.planned_on)} ${MEAL_LABEL[source.meal].toLowerCase()}` : "an earlier cook"}
                        </p>
                        <RowControls
                          eaters={row.eaters}
                          busy={busy}
                          onEaters={(n) => void run(() => data.updateEaters(row.id, n))}
                          onRemove={() => void run(() => data.deletePlanRow(row.id))}
                          removeLabel="Remove"
                        />
                      </li>
                    );
                  }

                  const portions = portionsToMake(row, all);
                  const extras = all.filter((r) => r.leftovers_from === row.id);
                  const candidates = leftoverCandidates(row, all);
                  return (
                    <li key={row.id} className="rounded-field p-3" style={{ background: "var(--pine-wash)" }}>
                      <p className="text-[13px] font-semibold text-muted">{MEAL_LABEL[row.meal]} · cooking</p>
                      <p className="text-[15px] font-semibold">{recipeName}</p>
                      <p className="mt-1">
                        <span className="font-display text-[22px] font-bold">Make {portions}</span>{" "}
                        <span className="text-[14px] text-muted">{portions === 1 ? "portion" : "portions"}</span>
                      </p>
                      <p className="text-[13px] text-muted">
                        {row.eaters} now
                        {extras.length > 0
                          ? ` + ${portions - row.eaters} for ${extras
                              .map((e) => `${shortDay(e.planned_on)} ${MEAL_LABEL[e.meal].toLowerCase()}`)
                              .join(", ")}`
                          : ""}
                        {recipe ? ` · recipe makes ${Number(recipe.servings)}, so ${scaleNote(portions, Number(recipe.servings))}` : ""}
                      </p>

                      <RowControls
                        eaters={row.eaters}
                        busy={busy}
                        onEaters={(n) => void run(() => data.updateEaters(row.id, n))}
                        onRemove={() => void run(() => data.deletePlanRow(row.id))}
                        removeLabel={extras.length > 0 ? "Remove, with its leftovers" : "Remove"}
                      />

                      <div className="mt-2">
                        <button
                          type="button"
                          className="btn btn-quiet w-full"
                          aria-expanded={extraFor === row.id}
                          onClick={() => setExtraFor(extraFor === row.id ? null : row.id)}
                          disabled={busy || candidates.length === 0}
                        >
                          {candidates.length === 0 ? "No free meals in the next 4 days" : "Make extra for…"}
                        </button>
                        {extraFor === row.id && (
                          <div className="mt-2">
                            <p className="text-[13px] text-muted">
                              Tap a later meal to cook enough for it now ({row.eaters} {row.eaters === 1 ? "person" : "people"}; change it after).
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {candidates.map((slot) => (
                                <button
                                  key={`${slot.planned_on}-${slot.meal}`}
                                  type="button"
                                  className="chip"
                                  disabled={busy}
                                  onClick={() =>
                                    void run(() =>
                                      data
                                        .addPlanRow(householdId, userId, {
                                          planned_on: slot.planned_on,
                                          meal: slot.meal,
                                          recipe_id: row.recipe_id,
                                          eaters: row.eaters,
                                          leftovers_from: row.id,
                                        })
                                        .then(() => undefined),
                                    )
                                  }
                                >
                                  {shortDay(slot.planned_on)} {MEAL_LABEL[slot.meal].toLowerCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {adding === day && (
                <AddMeal
                  recipes={recipes}
                  taken={taken}
                  busy={busy}
                  onCancel={() => setAdding(null)}
                  onAdd={(meal, recipeId, eaters) =>
                    void run(async () => {
                      await data.addPlanRow(householdId, userId, {
                        planned_on: day,
                        meal,
                        recipe_id: recipeId,
                        eaters,
                        leftovers_from: null,
                      });
                      setAdding(null);
                    })
                  }
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Stepper({ value, onChange, busy, label }: { value: number; onChange: (n: number) => void; busy: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <button
        type="button"
        className="btn btn-quiet"
        style={{ width: 44, padding: 0 }}
        aria-label={`Fewer — ${label}`}
        disabled={busy || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output className="w-7 text-center font-display text-lg font-bold">{value}</output>
      <button
        type="button"
        className="btn btn-quiet"
        style={{ width: 44, padding: 0 }}
        aria-label={`More — ${label}`}
        disabled={busy || value >= 20}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function RowControls({
  eaters,
  busy,
  onEaters,
  onRemove,
  removeLabel,
}: {
  eaters: number;
  busy: boolean;
  onEaters: (n: number) => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-muted">People</span>
        <Stepper value={eaters} onChange={onEaters} busy={busy} label="people eating" />
      </div>
      <button type="button" className="btn btn-quiet" onClick={onRemove} disabled={busy}>
        {removeLabel}
      </button>
    </div>
  );
}

function AddMeal({
  recipes,
  taken,
  busy,
  onCancel,
  onAdd,
}: {
  recipes: readonly Recipe[];
  taken: ReadonlySet<MealSlot>;
  busy: boolean;
  onCancel: () => void;
  onAdd: (meal: MealSlot, recipeId: string, eaters: number) => void;
}) {
  const free = MEAL_SLOTS.filter((m) => !taken.has(m));
  const [meal, setMeal] = useState<MealSlot>(free.includes("dinner") ? "dinner" : (free[0] ?? "dinner"));
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [eaters, setEaters] = useState(2);

  return (
    <div className="mt-3 grid gap-3 rounded-field p-3" style={{ border: "1px solid var(--line)" }}>
      <div role="radiogroup" aria-label="Which meal" className="flex flex-wrap gap-1.5">
        {free.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={meal === m}
            data-active={meal === m}
            className="chip"
            onClick={() => setMeal(m)}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </div>
      <label className="grid gap-1.5">
        <span className="text-[13px] font-semibold text-muted">Recipe</span>
        <select className="field" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} (makes {Number(r.servings)})
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-muted">People eating</span>
        <Stepper value={eaters} onChange={setEaters} busy={busy} label="people eating" />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary flex-1"
          disabled={busy || !recipeId}
          onClick={() => onAdd(meal, recipeId, eaters)}
        >
          Add {MEAL_LABEL[meal].toLowerCase()}
        </button>
      </div>
    </div>
  );
}
