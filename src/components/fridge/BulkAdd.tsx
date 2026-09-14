"use client";

import { useState } from "react";
import { postAi } from "@/lib/ai/client";
import { SortResponse } from "@/lib/ai/schemas";
import { isoInDays, LOCATION_LABEL, LOCATIONS } from "@/lib/expiry";
import type { NewPantryItem } from "@/lib/fridge";
import type { StorageLocation } from "@/lib/supabase/database.types";
import { ErrorNote } from "@/components/ErrorNote";

type Row = NewPantryItem & { key: number; include: boolean };

/**
 * Paste a grocery haul, get it sorted, check it, then add. The sorted list is
 * a draft: every field is editable and nothing is inserted until "Add".
 */
export function BulkAdd({ onAdd }: { onAdd: (items: NewPantryItem[]) => Promise<void> }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [sorting, setSorting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sort(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!text.trim()) return;
    setSorting(true);
    setError(null);
    try {
      const { items } = await postAi("/api/sort-groceries", { text }, SortResponse);
      if (items.length === 0) {
        setError("Couldn't find any groceries in that. Try one item per line.");
        return;
      }
      setRows(
        items.map((item, i) => ({
          key: Date.now() + i,
          include: true,
          name: item.name,
          quantity: item.quantity,
          location: item.location,
          expires_on: item.shelf_life_days === null ? null : isoInDays(Math.max(0, item.shelf_life_days)),
        })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sorting failed. You can still add items one at a time above.");
    } finally {
      setSorting(false);
    }
  }

  function update(key: number, patch: Partial<Row>): void {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const chosen = rows.filter((r) => r.include && r.name.trim());

  async function add(): Promise<void> {
    setAdding(true);
    setError(null);
    try {
      await onAdd(chosen.map(({ name, quantity, location, expires_on }) => ({ name, quantity, location, expires_on })));
      setRows([]);
      setText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Those didn't save.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="card mt-4 p-5">
      <h2 className="font-display text-lg font-semibold">Bulk add a grocery haul</h2>
      <p className="mt-1 text-[13px] text-muted">
        Paste the list or receipt. Each item gets a place and a use-by date for you to check.
      </p>

      {rows.length === 0 ? (
        <form onSubmit={(e) => void sort(e)} className="mt-3">
          <label htmlFor="haul" className="sr-only">
            Grocery list
          </label>
          <textarea
            id="haul"
            className="field"
            rows={4}
            placeholder={"2 lb chicken thighs\nbag of spinach\nfrozen peas\nsourdough"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sorting}
          />
          <button type="submit" className="btn btn-quiet mt-2 w-full" disabled={sorting || !text.trim()}>
            {sorting ? "Sorting…" : "Sort it"}
          </button>
        </form>
      ) : (
        <div className="mt-3">
          <ul className="grid gap-3">
            {rows.map((row) => (
              <li
                key={row.key}
                className="rounded-field p-3"
                style={{ border: "1px solid var(--line)", opacity: row.include ? 1 : 0.55 }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Include ${row.name}`}
                    checked={row.include}
                    onChange={(e) => update(row.key, { include: e.target.checked })}
                    style={{ width: 22, height: 22, accentColor: "var(--pine)" }}
                  />
                  <input
                    aria-label="Name"
                    className="field flex-1"
                    value={row.name}
                    onChange={(e) => update(row.key, { name: e.target.value })}
                  />
                  <input
                    aria-label="Quantity"
                    className="field"
                    style={{ width: 88 }}
                    placeholder="qty"
                    value={row.quantity ?? ""}
                    onChange={(e) => update(row.key, { quantity: e.target.value || null })}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div role="radiogroup" aria-label={`Where ${row.name} goes`} className="flex gap-1.5">
                    {LOCATIONS.map((loc: StorageLocation) => (
                      <button
                        key={loc}
                        type="button"
                        role="radio"
                        aria-checked={row.location === loc}
                        data-active={row.location === loc}
                        className="chip"
                        onClick={() => update(row.key, { location: loc })}
                      >
                        {LOCATION_LABEL[loc]}
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    aria-label={`Use-by date for ${row.name}`}
                    className="field"
                    style={{ width: "auto", flex: "1 1 140px" }}
                    value={row.expires_on ?? ""}
                    onChange={(e) => update(row.key, { expires_on: e.target.value || null })}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-quiet" onClick={() => setRows([])} disabled={adding}>
              Start over
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={() => void add()}
              disabled={adding || chosen.length === 0}
            >
              {adding ? "Adding…" : `Add ${chosen.length} ${chosen.length === 1 ? "item" : "items"}`}
            </button>
          </div>
        </div>
      )}

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
    </section>
  );
}
