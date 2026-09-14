"use client";

import { useState } from "react";
import { round1, scalePortion, type MacroTotals } from "@/lib/totals";
import { NO_NUTRIENTS, NUTRIENT_FIELDS, scaleNutrients, type Nutrients } from "@/lib/nutrients";

/**
 * An editable staging area. Nothing here is in the log yet.
 *
 * A draft holds per-serving macros plus a servings count, and the totals shown
 * are derived from the two. Editing a total works backwards to the per-serving
 * figure, so changing the portion afterwards still scales sensibly instead of
 * quietly discarding the edit.
 *
 * The AI "describe it" path in phase 5 fills the same structure — the
 * confirm-before-write rule is the same whether the numbers came from your
 * food library or from a model.
 */
export type Draft = {
  key: string;
  name: string;
  /** Macros for ONE serving. */
  base: MacroTotals;
  servings: number;
  /** Whether confirming should add this to the household food library. */
  remember: boolean;
  /** What one serving is ("Serving: 2/3 cup (55g)"), or that it's a photo estimate. */
  note?: string;
  /** Fiber, sugar and sodium for ONE serving; null means unknown. */
  nutrients?: Nutrients;
  /** Carried to the food library so the next scan or search knows the serving. */
  servingLabel?: string | null;
  barcode?: string | null;
};

export const EMPTY_MACROS: MacroTotals = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };

export function draftTotals(draft: Draft): MacroTotals {
  return scalePortion(draft.base, draft.servings);
}

export function draftNutrients(draft: Draft): Nutrients {
  return scaleNutrients(draft.nutrients ?? NO_NUTRIENTS, draft.servings);
}

type Field = keyof MacroTotals;

const FIELDS: ReadonlyArray<{ key: Field; label: string; short: string }> = [
  { key: "kcal", label: "Calories", short: "kcal" },
  { key: "protein_g", label: "Protein in grams", short: "P" },
  { key: "carb_g", label: "Carbs in grams", short: "C" },
  { key: "fat_g", label: "Fat in grams", short: "F" },
];

export function DraftTable({
  drafts,
  onChange,
  onRemove,
}: {
  drafts: readonly Draft[];
  onChange: (key: string, next: Draft) => void;
  onRemove: (key: string) => void;
}) {
  if (drafts.length === 0) return null;

  return (
    <ul className="mt-4 grid grid-cols-1 gap-3">
      {drafts.map((draft) => {
        const totals = draftTotals(draft);
        return (
          <li
            key={draft.key}
            className="rounded-field p-3"
            style={{ background: "var(--pine-wash)", border: "1px solid var(--line)" }}
          >
            <div className="flex items-start gap-2">
              <input
                aria-label="Food name"
                className="field flex-1"
                value={draft.name}
                onChange={(e) => onChange(draft.key, { ...draft, name: e.target.value })}
              />
              <button
                type="button"
                onClick={() => onRemove(draft.key)}
                aria-label={`Discard ${draft.name || "draft"}`}
                className="btn btn-quiet"
                style={{ width: 44, padding: 0 }}
              >
                ✕
              </button>
            </div>

            {draft.note && <p className="mt-1.5 text-[13px] text-muted">{draft.note}</p>}

            <div className="mt-2 flex items-center gap-2">
              <label htmlFor={`servings-${draft.key}`} className="text-[13px] font-semibold text-muted">
                Servings
              </label>
              <input
                id={`servings-${draft.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                className="field"
                style={{ width: 88 }}
                value={draft.servings}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  onChange(draft.key, { ...draft, servings: Number(e.target.value) })
                }
              />
              <div className="flex gap-1">
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    data-active={draft.servings === s}
                    onClick={() => onChange(draft.key, { ...draft, servings: s })}
                  >
                    ×{s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-2">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label
                    htmlFor={`${f.key}-${draft.key}`}
                    className="block text-[11px] font-semibold text-muted"
                  >
                    {f.short}
                  </label>
                  <input
                    id={`${f.key}-${draft.key}`}
                    aria-label={f.label}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    className="field mt-1 px-2"
                    value={totals[f.key]}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const total = Number(e.target.value);
                      const servings = draft.servings > 0 ? draft.servings : 1;
                      // Work the edit back to a per-serving figure so the
                      // portion control keeps making sense afterwards.
                      onChange(draft.key, {
                        ...draft,
                        servings,
                        base: { ...draft.base, [f.key]: round1(total / servings) },
                      });
                    }}
                  />
                </div>
              ))}
            </div>

            <MoreNutrients draft={draft} onChange={(next) => onChange(draft.key, next)} />

            <label className="mt-3 flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={draft.remember}
                onChange={(e) => onChange(draft.key, { ...draft, remember: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: "var(--pine)" }}
              />
              Remember this food
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** Fiber, sugar, sodium: collapsed unless known, since most hand-typed foods won't have them. Blank means unknown, not zero. */
function MoreNutrients({ draft, onChange }: { draft: Draft; onChange: (next: Draft) => void }) {
  const known = NUTRIENT_FIELDS.some((f) => draft.nutrients?.[f.key] != null);
  const [open, setOpen] = useState(known);
  const totals = draftNutrients(draft);

  if (!open) {
    return (
      <button
        type="button"
        className="mt-2 text-[13px] font-semibold underline"
        style={{ color: "var(--pine)", minHeight: 32 }}
        onClick={() => setOpen(true)}
      >
        + Fiber, sugar, sodium
      </button>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {NUTRIENT_FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={`${f.key}-${draft.key}`} className="block text-[11px] font-semibold text-muted">
            {f.label} ({f.unit})
          </label>
          <input
            id={`${f.key}-${draft.key}`}
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="?"
            className="field mt-1 px-2"
            value={totals[f.key] ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const servings = draft.servings > 0 ? draft.servings : 1;
              const perServing = raw === "" ? null : Math.round((Number(raw) / servings) * 10) / 10;
              onChange({ ...draft, servings, nutrients: { ...(draft.nutrients ?? NO_NUTRIENTS), [f.key]: perServing } });
            }}
          />
        </div>
      ))}
    </div>
  );
}
