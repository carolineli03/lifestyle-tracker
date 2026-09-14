"use client";

import { useEffect, useState } from "react";
import { addDays, fromIsoDate, type IsoDate } from "@/lib/date";
import { bestStreak, currentStreak, weeklyReport, type WeeklyReport } from "@/lib/report";
import { fetchReportData } from "@/lib/progress";

function short(iso: IsoDate): string {
  return fromIsoDate(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function WeeklyReportCard({
  today,
  kcalTarget,
  proteinTarget,
  waterGoalOz,
}: {
  today: IsoDate;
  kcalTarget: number | null;
  proteinTarget: number | null;
  waterGoalOz: number;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [streaks, setStreaks] = useState<{ current: number; best: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReportData(addDays(today, -6))
      .then((d) => {
        if (cancelled) return;
        setReport(weeklyReport({ today, ...d, kcalTarget, proteinTarget }));
        setStreaks({ current: currentStreak(d.loggedDays, today), best: bestStreak(d.loggedDays) });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the report.");
      });
    return () => {
      cancelled = true;
    };
  }, [today, kcalTarget, proteinTarget]);

  return (
    <section className="card mt-4 p-5" aria-labelledby="report-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="report-heading" className="font-display text-lg font-semibold">
          This week
        </h2>
        {report && (
          <span className="text-[13px] text-muted">
            {short(report.from)} – {short(report.to)}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[14px]" style={{ color: "var(--tomato)" }}>
          {error}
        </p>
      )}
      {!report && !error && <p className="mt-2 text-[14px] text-muted">Loading…</p>}

      {report && streaks && (
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <Tile label="Streak" value={`${streaks.current} ${streaks.current === 1 ? "day" : "days"}`} sub={`Best ${streaks.best}`} />
          <Tile label="Days logged" value={`${report.daysLogged} of 7`} sub={kcalTarget ? `${report.daysOnTarget} on target` : undefined} />
          <Tile
            label="Avg calories"
            value={report.avgKcal === null ? "—" : report.avgKcal.toLocaleString()}
            sub={kcalTarget ? `target ${kcalTarget.toLocaleString()}` : undefined}
          />
          <Tile
            label="Avg protein"
            value={report.avgProtein === null ? "—" : `${report.avgProtein} g`}
            sub={proteinTarget ? `target ${proteinTarget} g` : undefined}
          />
          <Tile
            label="Weight"
            value={report.weightChange === null ? "—" : `${report.weightChange > 0 ? "+" : report.weightChange < 0 ? "−" : ""}${Math.abs(report.weightChange)} lb`}
            sub={report.weightChange === null ? "needs 2 weigh-ins" : undefined}
          />
          <Tile
            label="Movement"
            value={`${report.movementMinutes} min`}
            sub={report.movementKcal ? `~${report.movementKcal.toLocaleString()} kcal` : undefined}
          />
          <Tile
            label="Avg water"
            value={report.avgWaterOz === null ? "—" : `${report.avgWaterOz} oz`}
            sub={`goal ${waterGoalOz} oz`}
          />
        </dl>
      )}
      <p className="mt-2 text-[12px] text-muted">Averages count only days you logged; an unlogged day isn&rsquo;t a zero.</p>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-field px-3 py-2.5" style={{ background: "var(--pine-wash)" }}>
      <dt className="text-[12px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 font-display text-[20px] font-bold leading-tight">{value}</dd>
      {sub && <dd className="m-0 text-[12px] text-muted">{sub}</dd>}
    </div>
  );
}
