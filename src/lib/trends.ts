import { addDays, type IsoDate } from "@/lib/date";
import { daysUntil } from "@/lib/expiry";

/**
 * Progress-tab arithmetic that isn't the calculator: the goal-pace line, the
 * stat row, and the seven-day movement bars. All dates are local calendar days.
 */

export type WeightPoint = { date: IsoDate; weight: number };

/**
 * Weight the straight goal-pace line expects on `date`. Outside the start–goal
 * window it holds at the nearer end rather than extrapolating past the goal.
 */
export function goalPaceWeight(start: WeightPoint, goal: WeightPoint, date: IsoDate): number {
  const span = daysUntil(goal.date, start.date);
  if (span <= 0) return goal.weight;
  const t = Math.min(1, Math.max(0, daysUntil(date, start.date) / span));
  return start.weight + (goal.weight - start.weight) * t;
}

export type WeightStats = {
  latest: WeightPoint | null;
  /** Latest minus the starting weight. Negative means lost. */
  change: number | null;
  /**
   * Pounds still between latest and goal, in the direction of travel. Zero or
   * below means the goal has been reached.
   */
  toGo: number | null;
};

export function weightStats(
  points: readonly WeightPoint[],
  startWeight: number | null,
  goalWeight: number | null,
): WeightStats {
  if (points.length === 0) return { latest: null, change: null, toGo: null };

  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const first = sorted[0]!;
  const latest = sorted[sorted.length - 1]!;
  const start = startWeight ?? first.weight;

  let toGo: number | null = null;
  if (goalWeight !== null) {
    const losing = goalWeight <= start;
    toGo = round1(losing ? latest.weight - goalWeight : goalWeight - latest.weight);
  }

  return { latest, change: round1(latest.weight - start), toGo };
}

export type DayMinutes = { date: IsoDate; minutes: number };

/** Minutes per day for the seven local days ending on `today`, oldest first. */
export function lastSevenDays(
  rows: readonly { logged_on: IsoDate; minutes: number }[],
  today: IsoDate,
): DayMinutes[] {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return days.map((date) => ({
    date,
    minutes: rows.filter((r) => r.logged_on === date).reduce((sum, r) => sum + r.minutes, 0),
  }));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
