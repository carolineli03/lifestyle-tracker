"use client";

import { useMemo, useRef, useState } from "react";
import type { Food, MealSlot } from "@/lib/supabase/database.types";
import { rankFoods, round1 } from "@/lib/totals";
import { postAi } from "@/lib/ai/client";
import { EstimateResponse } from "@/lib/ai/schemas";
import { defaultMeal, SECTION_LABEL } from "@/lib/meals";
import { MEAL_SLOTS } from "@/lib/planner";
import type { LogInput } from "@/lib/today";
import type { DbFood } from "@/lib/fooddb";
import { DraftTable, EMPTY_MACROS, draftNutrients, draftTotals, type Draft } from "./DraftTable";
import { PhotoLog } from "./PhotoLog";
import { ScanLog } from "./ScanLog";
import { FoodDbResults } from "./FoodDbResults";
import { QuickAdd } from "./QuickAdd";
import { VoiceButton } from "./VoiceButton";
import { ErrorNote } from "@/components/ErrorNote";

type Tab = "search" | "scan" | "photo" | "describe" | "quick";

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "search", label: "Search" },
  { value: "scan", label: "Scan" },
  { value: "photo", label: "Photo" },
  { value: "describe", label: "Describe" },
  { value: "quick", label: "Quick add" },
];

let draftCounter = 0;
function nextKey(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

function foodToDraft(food: Food): Draft {
  return {
    key: nextKey(),
    name: food.name,
    base: { kcal: Number(food.kcal), protein_g: Number(food.protein_g), carb_g: Number(food.carb_g), fat_g: Number(food.fat_g) },
    nutrients: { fiber_g: num(food.fiber_g), sugar_g: num(food.sugar_g), sodium_mg: num(food.sodium_mg) },
    servingLabel: food.serving_label,
    barcode: food.barcode,
    note: food.serving_label ? `1 serving = ${food.serving_label}` : undefined,
    servings: 1,
    remember: true,
  };
}

export function dbFoodToDraft(food: DbFood): Omit<Draft, "key"> {
  return {
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    base: food.macros,
    nutrients: food.nutrients,
    servingLabel: food.servingLabel,
    barcode: food.barcode,
    note: `${food.sourceLabel} · 1 serving = ${food.servingLabel}${food.per100g ? " (no serving size listed, so this is per 100 g)" : ""}. Set how many you had.`,
    servings: 1,
    remember: true,
  };
}

export function LogFood({
  foods,
  onConfirm,
  busy,
}: {
  foods: readonly Food[];
  onConfirm: (items: readonly LogInput[]) => Promise<void>;
  busy: boolean;
}) {
  const [tab, setTab] = useState<Tab>("search");
  const [meal, setMeal] = useState<MealSlot>(() => defaultMeal());
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [estimating, setEstimating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ranked in memory against the library we already hold, so results land on
  // the same keystroke rather than one network round trip later.
  const matches = useMemo(() => rankFoods(foods, query, query.trim() ? 8 : 4), [foods, query]);
  const showSuggestions = matches.length > 0 && (query.trim().length > 0 || drafts.length === 0);

  function addDrafts(items: ReadonlyArray<Omit<Draft, "key">>): void {
    setDrafts((d) => [...d, ...items.map((item) => ({ ...item, key: nextKey() }))]);
  }

  function addDraft(draft: Draft): void {
    setDrafts((d) => [...d, draft]);
    setQuery("");
    searchRef.current?.focus();
  }

  // The model's items become ordinary drafts: the same editable rows, the same
  // confirm button. A failure leaves the text in the box and search one tap away.
  async function estimate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const text = description.trim();
    if (!text) return;
    setEstimating(true);
    setError(null);
    try {
      const { items } = await postAi("/api/estimate", { text }, EstimateResponse);
      if (items.length === 0) {
        setError("That didn't read as food or drink. Try describing it differently, or search.");
        return;
      }
      addDrafts(
        items.map((item) => ({
          name: item.name,
          base: { kcal: Math.round(item.kcal), protein_g: round1(item.protein), carb_g: round1(item.carbs), fat_g: round1(item.fat) },
          nutrients: { fiber_g: item.fiber_g, sugar_g: item.sugar_g, sodium_mg: item.sodium_mg },
          note: "Estimated. Check the numbers.",
          servings: 1,
          remember: true,
        })),
      );
      setDescription("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The estimate failed. You can still add foods by hand.");
    } finally {
      setEstimating(false);
    }
  }

  async function confirm(): Promise<void> {
    const items: LogInput[] = drafts
      .filter((d) => d.name.trim().length > 0)
      .map((d) => ({
        name: d.name.trim(),
        macros: draftTotals(d),
        nutrients: draftNutrients(d),
        perServing: d.base,
        nutrientsPerServing: d.nutrients,
        meal,
        remember: d.remember,
        servingLabel: d.servingLabel ?? null,
        barcode: d.barcode ?? null,
      }));

    if (items.length === 0) {
      setError("Give each item a name before adding it.");
      return;
    }

    setError(null);
    try {
      await onConfirm(items);
      setDrafts([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong saving that.");
    }
  }

  return (
    <section className="card mt-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Log food</h2>
        <label className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          to
          <select
            className="field"
            style={{ width: "auto", minHeight: 36, padding: "0.25rem 0.5rem" }}
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealSlot)}
            aria-label="Meal"
          >
            {MEAL_SLOTS.map((m) => (
              <option key={m} value={m}>
                {SECTION_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="tablist" aria-label="How to log" className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            data-active={tab === t.value}
            className="chip"
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "scan" && (
        <ScanLog
          onError={setError}
          onDraft={(d) => addDrafts([d])}
          onUsePhoto={() => setTab("photo")}
          toDraft={dbFoodToDraft}
          findInLibrary={(codes) => {
            const food = foods.find((f) => f.barcode && codes.includes(f.barcode));
            if (!food) return null;
            const { key: _key, ...draft } = foodToDraft(food);
            return draft;
          }}
        />
      )}

      {tab === "photo" && <PhotoLog onError={setError} onDrafts={addDrafts} />}

      {tab === "quick" && (
        <QuickAdd
          busy={busy}
          onAdd={async (macros) => {
            setError(null);
            try {
              await onConfirm([{ name: "Quick add", macros, meal, remember: false }]);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "That didn't save.");
              throw cause;
            }
          }}
        />
      )}

      {tab === "search" && (
        <div className="mt-4">
          <label htmlFor="food-search" className="sr-only">
            Search foods
          </label>
          <input
            id="food-search"
            ref={searchRef}
            className="field"
            type="search"
            placeholder="Search your foods and the food database…"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />

          {showSuggestions && (
            <>
              {query.trim() && <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-muted">Your foods</p>}
              <ul className="mt-2 grid gap-1">
                {matches.map((food) => (
                  <li key={food.id}>
                    <button
                      type="button"
                      onClick={() => addDraft(foodToDraft(food))}
                      className="flex w-full items-center justify-between gap-3 rounded-field px-3 py-2 text-left"
                      style={{ border: "1px solid var(--line)", background: "var(--card)" }}
                    >
                      <span className="min-w-0 flex-1 truncate text-[15px]">{food.name}</span>
                      <span className="shrink-0 text-[13px] text-muted">
                        {Math.round(Number(food.kcal))} kcal · {Math.round(Number(food.protein_g))}p
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <FoodDbResults query={query} onPick={(food) => { addDrafts([dbFoodToDraft(food)]); setQuery(""); }} />

          {query.trim().length > 0 && (
            <button
              type="button"
              className="btn btn-quiet mt-2 w-full"
              onClick={() => addDraft({ key: nextKey(), name: query.trim(), base: { ...EMPTY_MACROS }, servings: 1, remember: true })}
            >
              Add &ldquo;{query.trim()}&rdquo; by hand
            </button>
          )}
        </div>
      )}

      {tab === "describe" && (
        <form className="mt-4" onSubmit={(e) => void estimate(e)}>
          <label htmlFor="food-describe" className="sr-only">
            Describe what you ate
          </label>
          <textarea
            id="food-describe"
            className="field"
            rows={3}
            placeholder="2 scrambled eggs, sourdough with butter, black coffee"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={estimating}
          />
          <div className="mt-2 flex gap-2">
            <VoiceButton onText={(t) => setDescription((d) => (d ? `${d} ${t}` : t))} disabled={estimating} />
            <button type="submit" className="btn btn-quiet flex-1" disabled={estimating || description.trim().length === 0}>
              {estimating ? "Estimating…" : "Estimate"}
            </button>
          </div>
          <p className="mt-2 text-[13px] text-muted">
            The estimate lands below as editable rows. Nothing is logged until you confirm.
          </p>
        </form>
      )}

      <DraftTable
        drafts={drafts}
        onChange={(key, next) => setDrafts((d) => d.map((x) => (x.key === key ? next : x)))}
        onRemove={(key) => setDrafts((d) => d.filter((x) => x.key !== key))}
      />

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {drafts.length > 0 && (
        <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => void confirm()} disabled={busy}>
          {busy ? "Adding…" : `Add ${drafts.length} ${drafts.length === 1 ? "item" : "items"} to ${SECTION_LABEL[meal].toLowerCase()}`}
        </button>
      )}
    </section>
  );
}
