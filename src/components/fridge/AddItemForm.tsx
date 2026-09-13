"use client";

import { useState } from "react";
import { LOCATION_LABEL, LOCATIONS } from "@/lib/expiry";
import type { StorageLocation } from "@/lib/supabase/database.types";
import type { NewPantryItem } from "@/lib/fridge";
import { ErrorNote } from "@/components/ErrorNote";

export function AddItemForm({ onAdd }: { onAdd: (item: NewPantryItem) => Promise<void> }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState<StorageLocation>("fridge");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the item a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd({
        name,
        quantity: quantity || null,
        location,
        expires_on: expires || null,
      });
      setName("");
      setQuantity("");
      setExpires("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-4 p-5">
      <h2 className="font-display text-lg font-semibold">Add to the kitchen</h2>

      <form onSubmit={submit} className="mt-3">
        <div className="flex gap-2">
          <input
            aria-label="Item name"
            className="field flex-1"
            placeholder="Chicken thighs"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            aria-label="Quantity"
            className="field"
            style={{ width: 104 }}
            placeholder="2 lb"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div role="radiogroup" aria-label="Where it lives" className="mt-3 flex gap-2">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              role="radio"
              aria-checked={location === loc}
              data-active={location === loc}
              className="chip"
              onClick={() => setLocation(loc)}
            >
              {LOCATION_LABEL[loc]}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="expires" className="text-[13px] font-semibold text-muted">
            Use by
          </label>
          <input
            id="expires"
            type="date"
            className="field flex-1"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
          {expires && (
            <button type="button" className="btn btn-quiet" onClick={() => setExpires("")}>
              Clear
            </button>
          )}
        </div>

        {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

        <button type="submit" className="btn btn-primary mt-3 w-full" disabled={busy}>
          {busy ? "Adding…" : "Add item"}
        </button>
      </form>

      <p className="mt-3 text-[13px] text-muted">
        Pasting a whole grocery haul and having it sorted into locations with shelf-life estimates
        arrives in phase 5.
      </p>
    </section>
  );
}
