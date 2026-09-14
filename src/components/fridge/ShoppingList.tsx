"use client";

import { useState } from "react";
import type { ShoppingListItem, StorageLocation } from "@/lib/supabase/database.types";
import { LOCATION_LABEL, LOCATIONS, isoInDays } from "@/lib/expiry";
import { ErrorNote } from "@/components/ErrorNote";

/**
 * What we need, as opposed to what we have.
 *
 * Ticking something off does not just delete it — it opens a small
 * put-it-away step so the thing you just bought lands in the kitchen with a
 * location and a use-by date, which is the whole point of keeping the list
 * next to the inventory.
 */
export function ShoppingList({
  items,
  onAdd,
  onRemove,
  onStock,
}: {
  items: readonly ShoppingListItem[];
  onAdd: (name: string, note: string | null) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onStock: (
    id: string,
    quantity: string | null,
    location: StorageLocation,
    expiresOn: string | null,
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stocking, setStocking] = useState<ShoppingListItem | null>(null);

  async function add(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(name, null);
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card mt-4 p-5">
      <h2 className="font-display text-lg font-semibold">
        Need to buy{" "}
        {items.length > 0 && (
          <span className="text-[15px] font-normal text-muted">({items.length})</span>
        )}
      </h2>

      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          aria-label="Add to the shopping list"
          className="field flex-1"
          placeholder="Tahini"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-quiet" disabled={busy}>
          Add
        </button>
      </form>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">
          Nothing on the list. Anything either of you marks as used up ends up here.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1">
          {items.map((item) => (
            <li key={item.id} className="border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-center gap-2 py-2">
                <button
                  type="button"
                  onClick={() => setStocking(stocking?.id === item.id ? null : item)}
                  aria-label={`Put ${item.name} away`}
                  aria-expanded={stocking?.id === item.id}
                  className="shrink-0 rounded-field"
                  style={{
                    width: 28,
                    height: 28,
                    minHeight: 28,
                    border: "2px solid var(--pine)",
                    color: "var(--pine)",
                  }}
                >
                  {stocking?.id === item.id ? "▾" : ""}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{item.name}</span>
                  {item.note && <span className="block text-[13px] text-muted">{item.note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => void onRemove(item.id)}
                  aria-label={`Remove ${item.name} from the list`}
                  className="shrink-0 text-muted"
                  style={{ width: 44, height: 44 }}
                >
                  ✕
                </button>
              </div>

              {stocking?.id === item.id && (
                <PutAway
                  item={item}
                  onCancel={() => setStocking(null)}
                  onStock={async (quantity, location, expiresOn) => {
                    await onStock(item.id, quantity, location, expiresOn);
                    setStocking(null);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PutAway({
  item,
  onCancel,
  onStock,
}: {
  item: ShoppingListItem;
  onCancel: () => void;
  onStock: (
    quantity: string | null,
    location: StorageLocation,
    expiresOn: string | null,
  ) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState<StorageLocation>("fridge");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-3 rounded-field p-3" style={{ background: "var(--pine-wash)" }}>
      <p className="text-[13px] font-semibold text-muted">Put {item.name} away</p>

      <div className="mt-2 flex gap-2">
        <input
          aria-label="Quantity"
          className="field flex-1"
          placeholder="How much?"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <input
          aria-label="Use by"
          type="date"
          className="field"
          style={{ width: 150 }}
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
        />
      </div>

      <div role="radiogroup" aria-label="Where it goes" className="mt-2 flex gap-2">
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

      <div className="mt-2 flex flex-wrap gap-1">
        {[3, 5, 7, 14].map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            data-active={expires === isoInDays(d)}
            onClick={() => setExpires(isoInDays(d))}
          >
            {d}d
          </button>
        ))}
      </div>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn btn-primary flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onStock(quantity || null, location, expires || null);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "That didn't save.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Putting away…" : "Into the kitchen"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
