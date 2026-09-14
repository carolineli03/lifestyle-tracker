"use client";

import { useState } from "react";
import type { ShoppingListItem, StorageLocation } from "@/lib/supabase/database.types";
import { LOCATION_LABEL, LOCATIONS, isoInDays } from "@/lib/expiry";
import { ErrorNote } from "@/components/ErrorNote";
import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";

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
  const toast = useToast();

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
    <div className="mt-4">
      <form onSubmit={add} className="flex gap-2">
        <input
          aria-label="Add to the shopping list"
          className="field flex-1"
          placeholder="Add to the list…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()} aria-label="Add">
          <Icon name="plus" size={20} strokeWidth={2.2} />
        </button>
      </form>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {items.length === 0 ? (
        <EmptyState icon="cart" text="Nothing to buy. Anything marked “used up” in the kitchen lands here." />
      ) : (
        <ul className="list mt-3">
          {items.map((item) => (
            <li key={item.id} className="list-row">
              <button
                type="button"
                onClick={() => setStocking(item)}
                aria-label={`Bought ${item.name}: put it away`}
                className="grid shrink-0 place-items-center rounded-full"
                style={{ width: 28, height: 28, minHeight: 28, border: "2px solid var(--pine)", color: "var(--pine)" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{item.name}</span>
                {item.note && <span className="t-meta block truncate">{item.note}</span>}
              </span>
              <button
                type="button"
                onClick={() => void onRemove(item.id)}
                aria-label={`Remove ${item.name} from the list`}
                className="icon-btn text-muted"
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={stocking !== null} onClose={() => setStocking(null)} title={stocking ? `Put ${stocking.name} away` : ""}>
        {stocking && (
          <PutAway
            key={stocking.id}
            item={stocking}
            onCancel={() => setStocking(null)}
            onStock={async (quantity, location, expiresOn) => {
              await onStock(stocking.id, quantity, location, expiresOn);
              toast({ message: `${stocking.name} is in the ${LOCATION_LABEL[location].toLowerCase()}` });
              setStocking(null);
            }}
          />
        )}
      </Sheet>
    </div>
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
    <div>
      <p className="t-meta">How much, where, and a use-by date if it has one.</p>

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
