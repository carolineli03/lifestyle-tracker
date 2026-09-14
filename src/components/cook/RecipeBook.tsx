"use client";

import { useState } from "react";
import type { Recipe, RecipeSource } from "@/lib/supabase/database.types";
import { addRecipe, deleteRecipe, type NewRecipe } from "@/lib/planner-data";
import { postAi } from "@/lib/ai/client";
import { ImportedRecipe } from "@/lib/ai/schemas";
import { ErrorNote } from "@/components/ErrorNote";

type Form = {
  name: string;
  servings: string;
  ingredients: string;
  method: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  source: RecipeSource;
};

const EMPTY: Form = { name: "", servings: "4", ingredients: "", method: "", kcal: "", protein: "", carbs: "", fat: "", source: "manual" };

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function RecipeBook({
  householdId,
  userId,
  recipes,
  onChanged,
}: {
  householdId: string;
  userId: string;
  recipes: readonly Recipe[];
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [pasted, setPasted] = useState("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Form>(key: K, value: Form[K]): void {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function importText(): Promise<void> {
    setImporting(true);
    setError(null);
    try {
      const r = await postAi("/api/import-recipe", { text: pasted }, ImportedRecipe);
      setForm({
        name: r.name,
        servings: r.servings ? String(r.servings) : "",
        ingredients: r.ingredients.join("\n"),
        method: r.method,
        kcal: r.per_serving ? String(Math.round(r.per_serving.kcal)) : "",
        protein: r.per_serving ? String(Math.round(r.per_serving.protein)) : "",
        carbs: r.per_serving ? String(Math.round(r.per_serving.carbs)) : "",
        fat: r.per_serving ? String(Math.round(r.per_serving.fat)) : "",
        source: "import",
      });
      setPasted("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed. You can still type the recipe in.");
    } finally {
      setImporting(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form) return;
    const servings = Number(form.servings);
    if (!form.name.trim()) return setError("Give the recipe a name.");
    if (!Number.isFinite(servings) || servings <= 0) return setError("Say how many servings the recipe makes.");

    const recipe: NewRecipe = {
      name: form.name,
      servings,
      ingredients: form.ingredients.split("\n"),
      method: form.method,
      kcal: optionalNumber(form.kcal),
      protein_g: optionalNumber(form.protein),
      carb_g: optionalNumber(form.carbs),
      fat_g: optionalNumber(form.fat),
      source: form.source,
    };
    setSaving(true);
    setError(null);
    try {
      await addRecipe(householdId, userId, recipe);
      await onChanged();
      setForm(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That recipe didn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    try {
      await deleteRecipe(id);
      setConfirmDelete(null);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't delete.");
    }
  }

  return (
    <>
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {form ? (
        <form onSubmit={(e) => void save(e)} className="card mt-4 grid gap-3 p-5" aria-labelledby="recipe-form-heading">
          <h2 id="recipe-form-heading" className="font-display text-lg font-semibold">
            {form.source === "import" ? "Check the imported recipe" : "Add a recipe"}
          </h2>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-muted">Name</span>
            <input className="field" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-muted">Makes how many servings</span>
            <input
              className="field"
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              value={form.servings}
              onChange={(e) => set("servings", e.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-muted">Ingredients, one per line</span>
            <textarea
              className="field"
              rows={5}
              placeholder={"2 lb chicken thighs\n1 onion, diced"}
              value={form.ingredients}
              onChange={(e) => set("ingredients", e.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-muted">Method</span>
            <textarea className="field" rows={4} value={form.method} onChange={(e) => set("method", e.target.value)} />
          </label>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 text-[13px] font-semibold text-muted">Per serving (optional)</legend>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["kcal", "kcal"],
                  ["protein", "P (g)"],
                  ["carbs", "C (g)"],
                  ["fat", "F (g)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="grid gap-1">
                  <span className="text-[11px] font-semibold text-muted">{label}</span>
                  <input
                    className="field px-2"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <button type="button" className="btn btn-quiet" onClick={() => setForm(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? "Saving…" : "Save recipe"}
            </button>
          </div>
        </form>
      ) : (
        <section className="card mt-4 p-5" aria-labelledby="add-recipe-heading">
          <h2 id="add-recipe-heading" className="font-display text-lg font-semibold">
            Add a recipe
          </h2>
          <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => setForm({ ...EMPTY })}>
            Type one in
          </button>
          <label htmlFor="paste-recipe" className="mt-4 block text-[13px] font-semibold text-muted">
            Or paste a recipe to import
          </label>
          <textarea
            id="paste-recipe"
            className="field mt-1.5"
            rows={4}
            placeholder="Paste the title, ingredients and steps from anywhere."
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            disabled={importing}
          />
          <button
            type="button"
            className="btn btn-quiet mt-2 w-full"
            onClick={() => void importText()}
            disabled={importing || pasted.trim().length < 20}
          >
            {importing ? "Reading recipe…" : "Import"}
          </button>
          <p className="mt-2 text-[13px] text-muted">Imported recipes open in a form so you can check them before saving.</p>
        </section>
      )}

      <section className="card mt-4 p-5" aria-labelledby="recipes-heading">
        <h2 id="recipes-heading" className="font-display text-lg font-semibold">
          Recipes <span className="font-sans text-[14px] font-semibold text-muted">{recipes.length}</span>
        </h2>
        {recipes.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">
            None yet. Add one above, or tap &ldquo;Save recipe&rdquo; on an idea in the Ideas tab.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {recipes.map((r) => (
              <li key={r.id} className="rounded-field" style={{ border: "1px solid var(--line)" }}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                  aria-expanded={open === r.id}
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                    <span className="block text-[13px] text-muted">
                      Makes {Number(r.servings)}
                      {r.kcal !== null ? ` · ${Math.round(Number(r.kcal))} kcal each` : ""}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-muted">
                    {open === r.id ? "−" : "+"}
                  </span>
                </button>
                {open === r.id && (
                  <div className="px-3 pb-3 text-[14px]">
                    {r.ingredients.length > 0 && (
                      <ul className="list-disc pl-5">
                        {r.ingredients.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                    {r.method && <p className="mt-2 whitespace-pre-line text-muted">{r.method}</p>}
                    <div className="mt-3">
                      {confirmDelete === r.id ? (
                        <div className="flex gap-2">
                          <button type="button" className="btn btn-quiet flex-1" onClick={() => setConfirmDelete(null)}>
                            Keep
                          </button>
                          <button
                            type="button"
                            className="btn flex-1"
                            style={{ background: "var(--tomato)", color: "var(--on-pine)" }}
                            onClick={() => void remove(r.id)}
                          >
                            Delete, and its planned meals
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(r.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
