"use client";

import { useState } from "react";
import type { PantryItem, StorageLocation } from "@/lib/supabase/database.types";
import { LOCATION_LABEL, LOCATIONS, groupByLocation } from "@/lib/expiry";
import { Icon, type IconName } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ExpiryBadge } from "./ExpiryBadge";

export type LocationFilter = "all" | StorageLocation;

export const LOCATION_ICON: Record<StorageLocation, IconName> = {
  fridge: "fridge",
  freezer: "snowflake",
  pantry: "pantry",
};

/** The kitchen grouped by where things live. Tap an item for its actions. */
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
  const toast = useToast();
  const [open, setOpen] = useState<PantryItem | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = filter === "all" ? items : items.filter((i) => i.location === filter);
  const groups = groupByLocation(visible);

  async function run(fn: () => Promise<void>, message: string): Promise<void> {
    setBusy(true);
    try {
      await fn();
      toast({ message });
      setOpen(null);
    } catch (cause) {
      toast({ message: cause instanceof Error ? cause.message : "That didn't work." });
    } finally {
      setBusy(false);
    }
  }

  if (groups.length === 0) {
    return (
      <p className="t-meta mt-4 px-1 text-center">
        Nothing in the {filter === "all" ? "kitchen" : LOCATION_LABEL[filter].toLowerCase()} right now.
      </p>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.location}>
          <div className="mb-2 mt-5 flex items-center gap-2 px-1">
            <Icon name={LOCATION_ICON[group.location]} size={15} className="text-muted" />
            <h2 className="t-label">
              {LOCATION_LABEL[group.location]} · {group.items.length}
            </h2>
          </div>
          <ul className="list">
            {group.items.map((item) => (
              <li key={item.id}>
                <button type="button" className="list-row" onClick={() => setOpen(item)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{item.name}</span>
                    {item.quantity && <span className="t-meta block truncate">{item.quantity}</span>}
                  </span>
                  <ExpiryBadge expiresOn={item.expires_on} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        {open && (
          <div className="grid grid-cols-1 gap-2">
            <p className="t-meta flex items-center gap-2">
              {open.quantity ?? "No amount"} · {LOCATION_LABEL[open.location]} · <ExpiryBadge expiresOn={open.expires_on} />
            </p>
            <button
              type="button"
              className="btn btn-primary mt-2 w-full"
              disabled={busy}
              onClick={() => void run(() => onUsedUp(open), `${open.name} moved to the shopping list`)}
            >
              <Icon name="cart" size={18} />
              Used up: add to shopping list
            </button>
            <div className="grid grid-cols-2 gap-2">
              {LOCATIONS.filter((l) => l !== open.location).map((l) => (
                <button
                  key={l}
                  type="button"
                  className="btn btn-quiet"
                  disabled={busy}
                  onClick={() => void run(() => onMove(open, l), `Moved to ${LOCATION_LABEL[l].toLowerCase()}`)}
                >
                  <Icon name={LOCATION_ICON[l]} size={18} />
                  {LOCATION_LABEL[l]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-quiet w-full"
              style={{ color: "var(--tomato)" }}
              disabled={busy}
              onClick={() => void run(() => onRemove(open), `Removed ${open.name}`)}
            >
              <Icon name="trash" size={18} />
              Remove from kitchen
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
