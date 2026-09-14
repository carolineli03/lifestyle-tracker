"use client";

import { useState } from "react";
import type { PantryItem, StorageLocation } from "@/lib/supabase/database.types";
import { LOCATION_LABEL, groupByLocation } from "@/lib/expiry";
import { ExpiryBadge } from "./ExpiryBadge";

export type LocationFilter = "all" | StorageLocation;

export function InventoryList({
  items,
  filter,
  onRemove,
  onUsedUp,
  onMove,
}: {
  items: readonly PantryItem[];
  filter: LocationFilter;
  onRemove: (item: PantryItem) => Promise<void>;
  onUsedUp: (item: PantryItem) => Promise<void>;
  onMove: (item: PantryItem, to: StorageLocation) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = filter === "all" ? items : items.filter((i) => i.location === filter);
  const groups = groupByLocation(visible);

  async function run(id: string, fn: () => Promise<void>): Promise<void> {
    setBusyId(id);
    try {
      await fn();
      setOpenId(null);
    } finally {
      setBusyId(null);
    }
  }

  if (groups.length === 0) {
    return (
      <section className="card mt-4 p-5">
        <p className="text-[14px] text-muted">
          {items.length === 0
            ? "Nothing in the kitchen yet. Add something above and it shows up here, soonest-expiring first."
            : `Nothing in the ${filter === "all" ? "kitchen" : LOCATION_LABEL[filter].toLowerCase()} right now.`}
        </p>
      </section>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group.location} className="card mt-4 p-5">
          <h2 className="font-display text-lg font-semibold">
            {LOCATION_LABEL[group.location]}{" "}
            <span className="text-[15px] font-normal text-muted">({group.items.length})</span>
          </h2>

          <ul className="mt-3 grid grid-cols-1">
            {group.items.map((item) => {
              const open = openId === item.id;
              return (
                <li key={item.id} className="border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : item.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 py-2 text-left"
                    style={{ minHeight: 48 }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{item.name}</span>
                      {item.quantity && (
                        <span className="block text-[13px] text-muted">{item.quantity}</span>
                      )}
                    </span>
                    <ExpiryBadge expiresOn={item.expires_on} />
                  </button>

                  {open && (
                    <div className="flex flex-wrap gap-2 pb-3">
                      <button
                        type="button"
                        className="chip"
                        disabled={busyId === item.id}
                        onClick={() => void run(item.id, () => onUsedUp(item))}
                      >
                        Used up → shopping list
                      </button>
                      {(["fridge", "freezer", "pantry"] as const)
                        .filter((loc) => loc !== item.location)
                        .map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            className="chip"
                            disabled={busyId === item.id}
                            onClick={() => void run(item.id, () => onMove(item, loc))}
                          >
                            Move to {LOCATION_LABEL[loc].toLowerCase()}
                          </button>
                        ))}
                      <button
                        type="button"
                        className="chip"
                        disabled={busyId === item.id}
                        onClick={() => void run(item.id, () => onRemove(item))}
                        style={{ color: "var(--tomato)" }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
