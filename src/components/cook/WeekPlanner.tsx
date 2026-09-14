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
import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";

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
  const [openRow, setOpenRow] = useState<string | null>(null);
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
      <section className="mt-4" aria-labelledby="plan-heading">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => setWeekOf(addDays(start, -7))}>
            <Icon name="chevron-left" size={22} />
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
            <p className="t-meta">
              {fromIsoDate(start).toLocaleDateString(undefined, { day: "numeric", month: "short" })} –{" "}
              {fromIsoDate(end).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Next week" onClick={() => setWeekOf(addDays(start, 7))}>
            <Icon name="chevron-right" size={22} />
          </button>
        </div>

        <p className="t-meta mt-1 text-center" aria-live="polite">
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

      <ol className="mt-3 grid grid-cols-1 gap-2">
        {days.map((day) => {
          const dayRows = rowsForDay(all, day);
          const taken = new Set(dayRows.map((r) => r.meal));
          if (dayRows.length === 0) {
            // A day with nothing planned is one slim row, not an empty card.
            return (
              <li key={day} className="card flex items-center gap-2 py-1 pl-4 pr-1">
                <span className="min-w-0 flex-1 text-[15px]">
                  {dayHeading(day, today)}
                  <span className="t-meta ml-2">Nothing planned</span>
                </span>
                {recipes.length > 0 && (
                  <button type="button" className="icon-btn icon-btn-soft" onClick={() => setAdding(day)} disabled={busy} aria-label={`Plan a meal on ${dayHeading(day, today)}`}>
                    <Icon name="plus" size={20} strokeWidth={2.2} />
                  </button>
                )}
              </li>
            );
          }
          return (
            <li key={day} className="card py-2 pl-4 pr-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{dayHeading(day, today)}</h3>
                {recipes.length > 0 && taken.size < MEAL_SLOTS.length && (
                  <button type="button" className="icon-btn icon-btn-soft" onClick={() => setAdding(day)} disabled={busy} aria-label={`Plan another meal on ${dayHeading(day, today)}`}>
                    <Icon name="plus" size={20} strokeWidth={2.2} />
                  </button>
                )}
              </div>

              <ul className="-ml-2 mr-2 mt-1 grid grid-cols-1">
                {dayRows.map((row) => {
                  const recipeName = recipeById.get(row.recipe_id)?.name ?? "Recipe";
                  const cooked = isCooked(row);
                  const source = cooked ? undefined : all.find((r) => r.id === row.leftovers_from);
                  const portions = cooked ? portionsToMake(row, all) : 0;
                  return (
                    <li key={row.id}>
                      <button type="button" className="list-row rounded-field px-2" onClick={() => setOpenRow(row.id)}>
                        <span
                          className="list-row-lead"
                          style={cooked ? undefined : { background: "var(--marigold-wash)", color: "var(--ink)" }}
                          aria-hidden="true"
                        >
                          <Icon name={cooked ? "flame" : "fridge"} size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">{recipeName}</span>
                          <span className="t-meta block truncate">
                            {MEAL_LABEL[row.meal]} ·{" "}
                            {cooked
                              ? `${row.eaters} eating`
                              : `leftovers from ${source ? `${shortDay(source.planned_on)} ${MEAL_LABEL[source.meal].toLowerCase()}` : "an earlier cook"}`}
                          </span>
                        </span>
                        {cooked && (
                          <span className="shrink-0 text-right leading-tight">
                            <span className="block font-display text-[20px] font-bold">{portions}</span>
                            <span className="t-meta block">to make</span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <RowSheet
        row={all.find((r) => r.id === openRow) ?? null}
        all={all}
        recipe={recipeById.get(all.find((r) => r.id === openRow)?.recipe_id ?? "")}
        busy={busy}
        onClose={() => setOpenRow(null)}
        onEaters={(id, n) => void run(() => data.updateEaters(id, n))}
        onRemove={(id) =>
          void run(async () => {
            await data.deletePlanRow(id);
            setOpenRow(null);
          })
        }
        onExtra={(row, slot) =>
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
      />

      <Sheet open={adding !== null} onClose={() => setAdding(null)} title={adding ? `Plan ${dayHeading(adding, today)}` : ""}>
        {adding && (
          <AddMeal
            key={adding}
            recipes={recipes}
            taken={new Set(rowsForDay(all, adding).map((r) => r.meal))}
            busy={busy}
            onCancel={() => setAdding(null)}
            onAdd={(meal, recipeId, eaters) =>
              void run(async () => {
                await data.addPlanRow(householdId, userId, {
                  planned_on: adding,
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
      </Sheet>
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

function RowSheet({
  row,
  all,
  recipe,
  busy,
  onClose,
  onEaters,
  onRemove,
  onExtra,
}: {
  row: MealPlanEntry | null;
  all: readonly MealPlanEntry[];
  recipe: Recipe | undefined;
  busy: boolean;
  onClose: () => void;
  onEaters: (id: string, n: number) => void;
  onRemove: (id: string) => void;
  onExtra: (row: MealPlanEntry, slot: { planned_on: IsoDate; meal: MealSlot }) => void;
}) {
  const cooked = row ? isCooked(row) : false;
  const portions = row && cooked ? portionsToMake(row, all) : 0;
  const extras = row ? all.filter((r) => r.leftovers_from === row.id) : [];
  const candidates = row && cooked ? leftoverCandidates(row, all) : [];
  const source = row && !cooked ? all.find((r) => r.id === row.leftovers_from) : undefined;

  return (
    <Sheet open={row !== null} onClose={onClose} title={recipe?.name ?? "Planned meal"}>
      {row && (
        <div className="grid grid-cols-1 gap-4">
          <p className="t-meta">
            {fromIsoDate(row.planned_on).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })} ·{" "}
            {MEAL_LABEL[row.meal]}
            {!cooked && ` · leftovers from ${source ? `${shortDay(source.planned_on)} ${MEAL_LABEL[source.meal].toLowerCase()}` : "an earlier cook"}`}
          </p>

          {cooked && (
            <div className="rounded-field p-4 text-center" style={{ background: "var(--pine-wash)" }}>
              <p>
                <span className="font-display text-[40px] font-bold leading-none">{portions}</span>{" "}
                <span className="text-[15px] text-muted">{portions === 1 ? "portion" : "portions"} to make</span>
              </p>
              <p className="t-meta mt-1">
                {row.eaters} now
                {extras.length > 0
                  ? ` + ${portions - row.eaters} for ${extras.map((e) => `${shortDay(e.planned_on)} ${MEAL_LABEL[e.meal].toLowerCase()}`).join(", ")}`
                  : ""}
                {recipe ? ` · recipe makes ${Number(recipe.servings)}, so ${scaleNote(portions, Number(recipe.servings))}` : ""}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold">People eating</span>
            <Stepper value={row.eaters} onChange={(n) => onEaters(row.id, n)} busy={busy} label="people eating" />
          </div>

          {cooked && (
            <div>
              <p className="t-label">Make extra for</p>
              {candidates.length === 0 ? (
                <p className="t-meta mt-1">No free meals in the next 4 days.</p>
              ) : (
                <>
                  <p className="t-meta mt-1">
                    Tap a later meal to cook enough for it now ({row.eaters} {row.eaters === 1 ? "person" : "people"}).
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {candidates.map((slot) => (
                      <button key={`${slot.planned_on}-${slot.meal}`} type="button" className="chip" disabled={busy} onClick={() => onExtra(row, slot)}>
                        + {shortDay(slot.planned_on)} {MEAL_LABEL[slot.meal].toLowerCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button type="button" className="btn btn-quiet w-full" style={{ color: "var(--tomato)" }} onClick={() => onRemove(row.id)} disabled={busy}>
            <Icon name="trash" size={18} />
            {extras.length > 0 ? "Remove, with its leftovers" : "Remove from plan"}
          </button>
        </div>
      )}
    </Sheet>
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
    <div className="grid grid-cols-1 gap-3">
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
      <label className="grid grid-cols-1 gap-1.5">
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
