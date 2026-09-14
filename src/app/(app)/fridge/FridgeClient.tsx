"use client";

import { useCallback, useEffect, useState } from "react";
import type { Household, PantryItem, StorageLocation } from "@/lib/supabase/database.types";
import * as api from "@/lib/fridge";
import { LOCATION_LABEL, LOCATIONS, expiringSoon } from "@/lib/expiry";
import { AddItemForm } from "@/components/fridge/AddItemForm";
import { BulkAdd } from "@/components/fridge/BulkAdd";
import { InventoryList, type LocationFilter } from "@/components/fridge/InventoryList";
import { ShoppingList } from "@/components/fridge/ShoppingList";
import { ExpiryBadge } from "@/components/fridge/ExpiryBadge";
import { ErrorNote } from "@/components/ErrorNote";
import { SettingsLink } from "@/components/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";

type View = "kitchen" | "shopping";

/**
 * The shared kitchen: what you have, and what you need. Adding is behind one
 * button; the invite code, theme and account now live in Settings.
 */
export function FridgeClient({ userId, household }: { userId: string; household: Household }) {
  const toast = useToast();
  const [data, setData] = useState<api.KitchenData | null>(null);
  const [view, setView] = useState<View>("kitchen");
  const [filter, setFilter] = useState<LocationFilter>("all");
  const [adding, setAdding] = useState<"one" | "haul" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setData(await api.fetchKitchen());
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .fetchKitchen()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the kitchen.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function guard(fn: () => Promise<void>): Promise<void> {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work.");
      throw cause;
    }
  }

  const pantry = data?.pantry ?? [];
  const shopping = data?.shopping ?? [];
  const soon = expiringSoon(pantry);

  return (
    <>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h1 className="t-title">Kitchen</h1>
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-primary" style={{ minHeight: 40, padding: "0 14px" }} onClick={() => setAdding("one")}>
            <Icon name="plus" size={18} strokeWidth={2.2} />
            Add
          </button>
          <SettingsLink />
        </div>
      </header>

      <Segmented
        label="Kitchen or shopping list"
        value={view}
        onChange={setView}
        options={[
          { value: "kitchen", label: <><Icon name="fridge" size={16} />In the kitchen</>, badge: pantry.length },
          { value: "shopping", label: <><Icon name="cart" size={16} />To buy</>, badge: shopping.length },
        ]}
      />

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {loading && !data ? (
        <div aria-busy="true" className="mt-4 grid grid-cols-1 gap-3">
          <span className="sr-only">Loading the kitchen…</span>
          {[96, 160, 120].map((h, i) => (
            <div key={i} className="card" style={{ height: h, background: "var(--line)", borderColor: "transparent", opacity: 0.5 }} />
          ))}
        </div>
      ) : view === "shopping" ? (
        <ShoppingList
          items={shopping}
          onAdd={(name, note) => guard(() => api.addShoppingItem(household.id, userId, name, note).then(() => undefined))}
          onRemove={(id) => guard(() => api.deleteShoppingItem(id))}
          onStock={(id, quantity, location, expiresOn) =>
            guard(() => api.stockShoppingItem(id, quantity, location, expiresOn).then(() => undefined))
          }
        />
      ) : pantry.length === 0 ? (
        <div className="card mt-4">
          <EmptyState
            icon="fridge"
            text="Your kitchen is empty. Add what you have, or paste a grocery haul and it sorts itself."
            action={
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary" onClick={() => setAdding("one")}>
                  Add an item
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => setAdding("haul")}>
                  Paste a haul
                </button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {soon.length > 0 && (
            <>
              <div className="mb-2 mt-5 flex items-center gap-2 px-1">
                <Icon name="flame" size={15} className="text-marigold" />
                <h2 className="t-label">Use soon</h2>
              </div>
              <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
                {soon.map((item) => (
                  <li key={item.id} className="card shrink-0 px-3 py-2.5" style={{ width: 150, background: "var(--marigold-wash)", borderColor: "transparent" }}>
                    <p className="truncate text-[14px] font-semibold">{item.name}</p>
                    <div className="mt-1">
                      <ExpiryBadge expiresOn={item.expires_on} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-4">
            <Segmented
              size="sm"
              label="Filter by location"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", badge: pantry.length },
                ...LOCATIONS.map((l) => ({ value: l, label: LOCATION_LABEL[l], badge: pantry.filter((i) => i.location === l).length })),
              ]}
            />
          </div>

          <InventoryList
            items={pantry}
            filter={filter}
            onRemove={(item) => guard(() => api.deletePantryItem(item.id))}
            onUsedUp={(item) => guard(() => api.moveToShoppingList(item, userId))}
            onMove={(item: PantryItem, to: StorageLocation) => guard(() => api.updatePantryItem(item.id, { location: to }))}
          />
        </>
      )}

      <Sheet
        open={adding !== null}
        onClose={() => setAdding(null)}
        title="Add to the kitchen"
      >
        {adding && (
          <>
            <Segmented
              size="sm"
              label="How to add"
              value={adding}
              onChange={setAdding}
              options={[
                { value: "one", label: "One item" },
                { value: "haul", label: <><Icon name="sparkle" size={14} />Paste a haul</> },
              ]}
            />
            <div className="in-sheet mt-3">
              {adding === "one" ? (
                <AddItemForm
                  onAdd={async (item) => {
                    await guard(() => api.addPantryItems(household.id, userId, [item]).then(() => undefined));
                    toast({ message: `Added ${item.name}` });
                  }}
                />
              ) : (
                <BulkAdd
                  onAdd={async (items) => {
                    await guard(() => api.addPantryItems(household.id, userId, items).then(() => undefined));
                    toast({ message: `Added ${items.length} items to the kitchen` });
                    setAdding(null);
                  }}
                />
              )}
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
