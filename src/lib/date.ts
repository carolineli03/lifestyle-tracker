/**
 * Dates in Icebox are *local calendar days*, not instants.
 *
 * `logged_on` is a Postgres `date`. If you build it from a UTC timestamp, then
 * anyone west of Greenwich logging dinner after 5pm files it under tomorrow.
 * So every date here is derived from the browser's local clock and passed to
 * the database as a plain YYYY-MM-DD string — never as a Date, and never
 * through toISOString().
 */

export type IsoDate = string; // YYYY-MM-DD

export function toIsoDate(d: Date): IsoDate {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today, in the viewer's own timezone. */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

/** Parses YYYY-MM-DD into a local-midnight Date (not a UTC one). */
export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function isFuture(iso: IsoDate, today: IsoDate = todayIso()): boolean {
  return iso > today;
}

/** Monday-start week containing `iso`, as [start, end] inclusive. */
export function weekBounds(iso: IsoDate): { start: IsoDate; end: IsoDate } {
  const d = fromIsoDate(iso);
  const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0
  const start = addDays(iso, -dayOfWeek);
  return { start, end: addDays(start, 6) };
}

/** "Today", "Yesterday", or "Sat 13 Sep". */
export function describeDate(iso: IsoDate, today: IsoDate = todayIso()): string {
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  if (iso === addDays(today, 1)) return "Tomorrow";
  const d = fromIsoDate(iso);
  const sameYear = d.getFullYear() === fromIsoDate(today).getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
