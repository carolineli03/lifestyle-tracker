"use client";

import { useState } from "react";
import type { Recipe, RecipeSource } from "@/lib/supabase/database.types";
import { addRecipe, deleteRecipe, type NewRecipe } from "@/lib/planner-data";
import { postAi } from "@/lib/ai/client";
import { ImportedRecipe } from "@/lib/ai/schemas";
import { ErrorNote } from "@/components/ErrorNote";
import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";

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
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState<"type" | "paste">("type");
  const toast = useToast();

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
      toast({ message: `Saved ${recipe.name.trim()}` });
      closeAdd();
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
      setOpen(null);
      await onChanged();
      toast({ message: "Recipe deleted" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't delete.");
    }
  }

  const openRecipe = recipes.find((r) => r.id === open) ?? null;
  const [query, setQuery] = useState("");
  const shown = query.trim() ? recipes.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase())) : recipes;

  function closeAdd(): void {
    setAddOpen(false);
    setForm(null);
    setPasted("");
    setError(null);
  }

  const formBody = form && (
    <form id="recipe-form" onSubmit={(e) => void save(e)} className="grid grid-cols-1 gap-3">
      {form.source === "import" && <p className="t-meta">Check what was read before saving.</p>}
      <label className="grid grid-cols-1 gap-1.5">
        <span className="text-[13px] font-semibold text-muted">Name</span>
        <input className="field" value={form.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label className="grid grid-cols-1 gap-1.5">
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
      <label className="grid grid-cols-1 gap-1.5">
        <span className="text-[13px] font-semibold text-muted">Ingredients, one per line</span>
        <textarea
          className="field"
          rows={5}
          placeholder={"2 lb chicken thighs\n1 onion, diced"}
          value={form.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
        />
      </label>
      <label className="grid grid-cols-1 gap-1.5">
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
            <label key={key} className="grid grid-cols-1 gap-1">
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
    </form>
  );

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-2 px-1">
        <h2 id="recipes-heading" className="t-label">
          {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
        </h2>
        <button type="button" className="btn btn-primary" style={{ minHeight: 40, paddingInline: 16 }} onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={18} strokeWidth={2.2} />
          Add recipe
        </button>
      </div>

      {error && !addOpen && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {recipes.length > 8 && (
        <label className="mt-3 block">
          <span className="sr-only">Search recipes</span>
          <input className="field" type="search" placeholder="Search recipes" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}

      {recipes.length === 0 ? (
        <div className="card mt-3">
          <EmptyState
            icon="book"
            text={<>No recipes yet. Add one, or tap &ldquo;Save recipe&rdquo; on an idea.</>}
            action={
              <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
                Add a recipe
              </button>
            }
          />
        </div>
      ) : (
        <ul className="list mt-3" aria-labelledby="recipes-heading">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" className="list-row" onClick={() => setOpen(r.id)}>
                <span className="list-row-lead" aria-hidden="true">
                  <Icon name="book" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{r.name}</span>
                  <span className="t-meta block truncate">
                    Makes {Number(r.servings)}
                    {r.kcal !== null ? ` · ${Math.round(Number(r.kcal))} kcal each` : ""}
                  </span>
                </span>
                <Icon name="chevron-right" size={18} className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={addOpen}
        onClose={closeAdd}
        title={form ? (form.source === "import" ? "Check the recipe" : "New recipe") : "Add a recipe"}
        footer={
          form ? (
            <button type="submit" form="recipe-form" className="btn btn-primary w-full" disabled={saving}>
              {saving ? "Saving…" : "Save recipe"}
            </button>
          ) : undefined
        }
      >
        {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
        {form ? (
          formBody
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <Segmented
              label="How to add"
              value={mode}
              onChange={setMode}
              options={[
                { value: "type", label: "Type it" },
                { value: "paste", label: "Paste to import" },
              ]}
            />
            {mode === "type" ? (
              <button type="button" className="btn btn-primary w-full" onClick={() => setForm({ ...EMPTY })}>
                Start a blank recipe
              </button>
            ) : (
              <>
                <label htmlFor="paste-recipe" className="t-meta">
                  Paste the title, ingredients and steps from anywhere. You&rsquo;ll check it before saving.
                </label>
                <textarea
                  id="paste-recipe"
                  className="field"
                  rows={7}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  disabled={importing}
                />
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={() => void importText()}
                  disabled={importing || pasted.trim().length < 20}
                >
                  <Icon name="sparkle" size={18} />
                  {importing ? "Reading recipe…" : "Import"}
                </button>
              </>
            )}
          </div>
        )}
      </Sheet>

      <Sheet
        open={openRecipe !== null}
        onClose={() => {
          setOpen(null);
          setConfirmDelete(null);
        }}
        title={openRecipe?.name ?? ""}
      >
        {openRecipe && (
          <div className="grid grid-cols-1 gap-4 text-[15px]">
            <p className="t-meta">
              Makes {Number(openRecipe.servings)}
              {openRecipe.kcal !== null
                ? ` · ${Math.round(Number(openRecipe.kcal))} kcal, ${Math.round(Number(openRecipe.protein_g ?? 0))}p ${Math.round(Number(openRecipe.carb_g ?? 0))}c ${Math.round(Number(openRecipe.fat_g ?? 0))}f each`
                : ""}
            </p>
            {openRecipe.ingredients.length > 0 && (
              <div>
                <h3 className="t-label">Ingredients</h3>
                <ul className="mt-1.5 list-disc pl-5 leading-relaxed">
                  {openRecipe.ingredients.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {openRecipe.method && (
              <div>
                <h3 className="t-label">Method</h3>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed">{openRecipe.method}</p>
              </div>
            )}
            {confirmDelete === openRecipe.id ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(null)}>
                  Keep
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: "var(--tomato)", color: "var(--on-pine)" }}
                  onClick={() => void remove(openRecipe.id)}
                >
                  Delete + its plans
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-quiet w-full" style={{ color: "var(--tomato)" }} onClick={() => setConfirmDelete(openRecipe.id)}>
                <Icon name="trash" size={18} />
                Delete recipe
              </button>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
