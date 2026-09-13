import { fromIsoDate, todayIso, type IsoDate } from "@/lib/date";
import type { PantryItem, StorageLocation } from "@/lib/supabase/database.types";

/**
 * Expiry maths for the Fridge tab.
 *
 * Days are counted between local calendar days, not between instants — an
 * item that expires "tomorrow" should say 1 all day today, not flip to 0 at
 * some hour that depends on when the row was written.
 */

export type ExpiryTone = "gone" | "urgent" | "soon" | "calm";

export const LOCATIONS: readonly StorageLocation[] = ["fridge", "freezer", "pantry"];

export const LOCATION_LABEL: Record<StorageLocation, string> = {
  fridge: "Fridge",
  freezer: "Freezer",
  pantry: "Pantry",
};

const MS_PER_DAY = 86_400_000;

/** Whole days from today to `expiresOn`. Negative once it is past. */
export function daysUntil(expiresOn: IsoDate, today: IsoDate = todayIso()): number {
  const diff = fromIsoDate(expiresOn).getTime() - fromIsoDate(today).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/**
 * Red at two days or less (including already past), amber at five or less,
 * neutral otherwise. An item with no use-by date is always calm — tinned
 * tomatoes do not need a countdown.
 */
export function expiryTone(expiresOn: string | null, today: IsoDate = todayIso()): ExpiryTone {
  if (!expiresOn) return "calm";
  const days = daysUntil(expiresOn, today);
  if (days < 0) return "gone";
  if (days <= 2) return "urgent";
  if (days <= 5) return "soon";
  return "calm";
}

/**
 * Short badge text: "2d left", "Today", "3d ago".
 *
 * Past a month it switches to a plain date. "120d left" on a bag of frozen
 * peas is a countdown nobody is running — the date is quieter and says more.
 */
export function expiryLabel(expiresOn: string | null, today: IsoDate = todayIso()): string | null {
  if (!expiresOn) return null;
  const days = daysUntil(expiresOn, today);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return days === -1 ? "1d ago" : `${Math.abs(days)}d ago`;
  if (days > 30) {
    return fromIsoDate(expiresOn).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  return `${days}d left`;
}

/**
 * Soonest-expiring first, with undated items last. Ties break on name so the
 * list does not reshuffle between renders.
 */
export function byExpiry<T extends { expires_on: string | null; name: string }>(a: T, b: T): number {
  if (a.expires_on && b.expires_on) {
    if (a.expires_on !== b.expires_on) return a.expires_on < b.expires_on ? -1 : 1;
    return a.name.localeCompare(b.name);
  }
  if (a.expires_on) return -1;
  if (b.expires_on) return 1;
  return a.name.localeCompare(b.name);
}

export type LocationGroup = { location: StorageLocation; items: PantryItem[] };

/**
 * Groups the inventory by where it lives, each group sorted by urgency.
 * Empty locations are dropped — an empty freezer heading is just noise.
 */
export function groupByLocation(items: readonly PantryItem[]): LocationGroup[] {
  return LOCATIONS.map((location) => ({
    location,
    items: items.filter((i) => i.location === location).sort(byExpiry),
  })).filter((g) => g.items.length > 0);
}

/** Items worth acting on today, soonest first — drives the "use these up" nudge. */
export function expiringSoon(
  items: readonly PantryItem[],
  today: IsoDate = todayIso(),
  withinDays = 5,
): PantryItem[] {
  return items
    .filter((i) => i.expires_on !== null && daysUntil(i.expires_on, today) <= withinDays)
    .sort(byExpiry);
}

/** A use-by date `days` from today, for the shelf-life estimates. */
export function isoInDays(days: number, today: IsoDate = todayIso()): IsoDate {
  const d = fromIsoDate(today);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
