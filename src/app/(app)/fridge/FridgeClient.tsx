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
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountCard } from "@/components/AccountCard";

export function FridgeClient({
  userId,
  household,
  isGuest,
  email,
}: {
  userId: string;
  household: Household;
  isGuest: boolean;
  email: string | null;
}) {
  const [data, setData] = useState<api.KitchenData | null>(null);
  const [filter, setFilter] = useState<LocationFilter>("all");
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
  const soon = expiringSoon(pantry);

  if (loading && !data) {
    return (
      <div aria-busy="true" aria-live="polite" className="grid grid-cols-1 gap-4">
        <span className="sr-only">Loading the kitchen…</span>
        {[120, 180, 160].map((h, i) => (
          <div
            key={i}
            className="card"
            style={{ height: h, background: "var(--line)", borderColor: "transparent", opacity: 0.5 }}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {soon.length > 0 && (
        <section
          className="card p-4"
          style={{ background: "var(--marigold-wash)", borderColor: "var(--marigold)" }}
        >
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--marigold)" }}>
            Use these up
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-1">
            {soon.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[15px]">{item.name}</span>
                <ExpiryBadge expiresOn={item.expires_on} />
              </li>
            ))}
          </ul>
          {soon.length > 4 && (
            <p className="mt-2 text-[13px] text-muted">and {soon.length - 4} more</p>
          )}
        </section>
      )}

      <div role="radiogroup" aria-label="Filter by location" className="mt-4 flex flex-wrap gap-2">
        {(["all", ...LOCATIONS] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            data-active={filter === f}
            className="chip"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : LOCATION_LABEL[f]}
            <span className="opacity-70">
              {f === "all" ? pantry.length : pantry.filter((i) => i.location === f).length}
            </span>
          </button>
        ))}
      </div>

      <InventoryList
        items={pantry}
        filter={filter}
        onRemove={(item) => guard(() => api.deletePantryItem(item.id))}
        onUsedUp={(item) => guard(() => api.moveToShoppingList(item, userId))}
        onMove={(item: PantryItem, to: StorageLocation) =>
          guard(() => api.updatePantryItem(item.id, { location: to }))
        }
      />

      <AddItemForm
        onAdd={(item) => guard(() => api.addPantryItems(household.id, userId, [item]).then(() => undefined))}
      />

      <BulkAdd onAdd={(items) => guard(() => api.addPantryItems(household.id, userId, items).then(() => undefined))} />

      <ShoppingList
        items={data?.shopping ?? []}
        onAdd={(name, note) =>
          guard(() => api.addShoppingItem(household.id, userId, name, note).then(() => undefined))
        }
        onRemove={(id) => guard(() => api.deleteShoppingItem(id))}
        onStock={(id, quantity, location, expiresOn) =>
          guard(() => api.stockShoppingItem(id, quantity, location, expiresOn).then(() => undefined))
        }
      />

      <section className="card mt-4 p-5">
        <h2 className="font-display text-lg font-semibold">{household.name}</h2>
        <p className="mt-1 text-[13px] text-muted">
          Share this code so the other person&rsquo;s app sees the same fridge and list.
        </p>
        <p className="mt-3 font-display text-3xl font-bold tracking-[0.3em]">{household.join_code}</p>
      </section>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-[13px] text-muted">Theme</span>
        <ThemeToggle />
      </div>

      <AccountCard isGuest={isGuest} email={email} />
    </>
  );
}
