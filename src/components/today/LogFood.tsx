"use client";

import { useMemo, useRef, useState } from "react";
import type { Food } from "@/lib/supabase/database.types";
import { rankFoods, round1, type MacroTotals } from "@/lib/totals";
import { postAi } from "@/lib/ai/client";
import { EstimateResponse } from "@/lib/ai/schemas";
import { DraftTable, EMPTY_MACROS, draftTotals, type Draft } from "./DraftTable";
import { PhotoLog } from "./PhotoLog";
import { ErrorNote } from "@/components/ErrorNote";

type Tab = "search" | "photo" | "describe";

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "search", label: "Search saved" },
  { value: "photo", label: "Photo" },
  { value: "describe", label: "Describe it" },
];

let draftCounter = 0;
function nextKey(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

function foodToDraft(food: Food): Draft {
  return {
    key: nextKey(),
    name: food.name,
    base: {
      kcal: Number(food.kcal),
      protein_g: Number(food.protein_g),
      carb_g: Number(food.carb_g),
      fat_g: Number(food.fat_g),
    },
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
  onConfirm: (
    items: ReadonlyArray<{ name: string; macros: MacroTotals; perServing: MacroTotals; remember: boolean }>,
  ) => Promise<void>;
  busy: boolean;
}) {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [estimating, setEstimating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ranked in memory against the library we already hold, so results land on
  // the same keystroke rather than one network round trip later.
  const matches = useMemo(() => rankFoods(foods, query, query.trim() ? 8 : 4), [foods, query]);

  // With nothing typed, the list is a quick-tap shortlist of what gets logged
  // most. Once something is staged it gets out of the way, so the drafts stay
  // next to the button that commits them.
  const showSuggestions = matches.length > 0 && (query.trim().length > 0 || drafts.length === 0);

  function addDraft(draft: Draft): void {
    setDrafts((d) => [...d, draft]);
    setQuery("");
    searchRef.current?.focus();
  }

  function addBlank(name: string): void {
    addDraft({
      key: nextKey(),
      name: name.trim(),
      base: { ...EMPTY_MACROS },
      servings: 1,
      remember: true,
    });
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
        setError("That didn't read as food or drink. Try describing it differently, or search saved foods.");
        return;
      }
      setDrafts((d) => [
        ...d,
        ...items.map((item) => ({
          key: nextKey(),
          name: item.name,
          base: { kcal: Math.round(item.kcal), protein_g: round1(item.protein), carb_g: round1(item.carbs), fat_g: round1(item.fat) },
          servings: 1,
          remember: true,
        })),
      ]);
      setDescription("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The estimate failed. You can still add foods by hand.");
    } finally {
      setEstimating(false);
    }
  }

  async function confirm(): Promise<void> {
    const items = drafts
      .map((d) => ({ name: d.name.trim(), macros: draftTotals(d), perServing: d.base, remember: d.remember }))
      .filter((d) => d.name.length > 0);

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
      <h2 className="font-display text-lg font-semibold">Log food</h2>

      <div role="tablist" aria-label="How to log" className="mt-3 flex flex-wrap gap-2">
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

      {tab === "photo" ? (
        <PhotoLog
          onError={setError}
          onDrafts={(items) => setDrafts((d) => [...d, ...items.map((item) => ({ ...item, key: nextKey() }))])}
        />
      ) : tab === "search" ? (
        <div className="mt-4">
          <label htmlFor="food-search" className="sr-only">
            Search your saved foods
          </label>
          <input
            id="food-search"
            ref={searchRef}
            className="field"
            placeholder={foods.length ? "Search saved foods…" : "Type a food to add it…"}
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />

          {showSuggestions && (
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
          )}

          {query.trim().length > 0 && (
            <button type="button" className="btn btn-quiet mt-2 w-full" onClick={() => addBlank(query)}>
              Add &ldquo;{query.trim()}&rdquo; as a new food
            </button>
          )}

          {query.trim().length === 0 && foods.length === 0 && (
            <p className="mt-2 text-[13px] text-muted">
              Your food library is empty. Anything you log here gets saved for next time.
            </p>
          )}
        </div>
      ) : (
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
          <button
            type="submit"
            className="btn btn-quiet mt-2 w-full"
            disabled={estimating || description.trim().length === 0}
          >
            {estimating ? "Estimating…" : "Estimate"}
          </button>
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
        <button type="button" className="btn btn-primary mt-4 w-full" onClick={confirm} disabled={busy}>
          {busy
            ? "Adding…"
            : `Add ${drafts.length} ${drafts.length === 1 ? "item" : "items"} to the log`}
        </button>
      )}
    </section>
  );
}
