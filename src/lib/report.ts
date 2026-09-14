import { addDays, type IsoDate } from "@/lib/date";

/**
 * Streaks and the weekly report. Days are local calendar days, like every
 * other date in the app.
 */

/**
 * Consecutive days with at least one food logged, ending today. If today has
 * nothing yet, the streak still counts through yesterday: it isn't broken until
 * the day is over.
 */
export function currentStreak(loggedDays: Iterable<IsoDate>, today: IsoDate): number {
  const days = new Set(loggedDays);
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(loggedDays: Iterable<IsoDate>): number {
  const sorted = [...new Set(loggedDays)].sort();
  let best = 0;
  let run = 0;
  let prev: IsoDate | null = null;
  for (const day of sorted) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

export type WeeklyInputs = {
  today: IsoDate;
  entries: ReadonlyArray<{ logged_on: IsoDate; kcal: number | string; protein_g: number | string }>;
  weighIns: ReadonlyArray<{ logged_on: IsoDate; weight_lb: number | string }>;
  movement: ReadonlyArray<{ logged_on: IsoDate; minutes: number; kcal: number | null }>;
  water: ReadonlyArray<{ logged_on: IsoDate; amount_oz: number | string }>;
  kcalTarget: number | null;
  proteinTarget: number | null;
};

export type WeeklyReport = {
  from: IsoDate;
  to: IsoDate;
  daysLogged: number;
  /** Averages over days that had food logged; an unlogged day isn't a 0-calorie day. */
  avgKcal: number | null;
  avgProtein: number | null;
  daysOnTarget: number;
  weightChange: number | null;
  movementMinutes: number;
  movementKcal: number;
  avgWaterOz: number | null;
};

/** The seven local days ending today. */
export function weeklyReport(i: WeeklyInputs): WeeklyReport {
  const from = addDays(i.today, -6);
  const inWindow = (d: IsoDate) => d >= from && d <= i.today;

  const byDay = new Map<IsoDate, { kcal: number; protein: number }>();
  for (const e of i.entries) {
    if (!inWindow(e.logged_on)) continue;
    const d = byDay.get(e.logged_on) ?? { kcal: 0, protein: 0 };
    d.kcal += Number(e.kcal);
    d.protein += Number(e.protein_g);
    byDay.set(e.logged_on, d);
  }
  const days = [...byDay.values()];
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  // "On target" = within 10% under or 5% over the calorie target.
  const daysOnTarget =
    i.kcalTarget === null
      ? 0
      : days.filter((d) => d.kcal >= (i.kcalTarget as number) * 0.9 && d.kcal <= (i.kcalTarget as number) * 1.05).length;

  const weights = i.weighIns.filter((w) => inWindow(w.logged_on)).sort((a, b) => (a.logged_on < b.logged_on ? -1 : 1));
  const weightChange =
    weights.length >= 2
      ? Math.round((Number(weights.at(-1)!.weight_lb) - Number(weights[0]!.weight_lb)) * 10) / 10
      : null;

  const moves = i.movement.filter((m) => inWindow(m.logged_on));
  const waterByDay = new Map<IsoDate, number>();
  for (const w of i.water) {
    if (inWindow(w.logged_on)) waterByDay.set(w.logged_on, (waterByDay.get(w.logged_on) ?? 0) + Number(w.amount_oz));
  }

  return {
    from,
    to: i.today,
    daysLogged: days.length,
    avgKcal: avg(days.map((d) => d.kcal)),
    avgProtein: avg(days.map((d) => d.protein)),
    daysOnTarget,
    weightChange,
    movementMinutes: moves.reduce((s, m) => s + m.minutes, 0),
    movementKcal: moves.reduce((s, m) => s + (m.kcal ?? 0), 0),
    avgWaterOz: avg([...waterByDay.values()]),
  };
}
