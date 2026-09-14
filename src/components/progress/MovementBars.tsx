import { fromIsoDate } from "@/lib/date";
import type { DayMinutes } from "@/lib/trends";

const W = 340;
const H = 150;
const PAD = { top: 16, bottom: 22, side: 4 };

/**
 * The last seven local days as bars. The dashed line is the weekly goal spread
 * evenly across days — a reference, not a daily quota.
 */
export function MovementBars({ days, weeklyGoal }: { days: readonly DayMinutes[]; weeklyGoal: number | null }) {
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  const perDay = weeklyGoal ? weeklyGoal / 7 : null;
  const top = Math.max(30, perDay ?? 0, ...days.map((d) => d.minutes)) * 1.1;

  const slot = (W - PAD.side * 2) / days.length;
  const barW = slot * 0.56;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (m: number): number => PAD.top + plotH - (m / top) * plotH;

  const summary =
    `Movement over the last seven days: ${total} minutes` +
    (weeklyGoal ? ` against a weekly goal of ${weeklyGoal}.` : ".") +
    " " +
    days.map((d) => `${weekday(d.date, "long")} ${d.minutes}`).join(", ");

  return (
    <section className="card mt-4 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Movement</h2>
        <p className="text-[13px] text-muted">
          Last 7 days · <span className="font-semibold text-ink">{total}</span>
          {weeklyGoal ? ` / ${weeklyGoal} min` : " min"}
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} className="mt-3" style={{ display: "block" }}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth={1} />
        {days.map((d, i) => {
          const cx = PAD.side + slot * i + slot / 2;
          const h = y(0) - y(d.minutes);
          return (
            <g key={d.date}>
              {d.minutes > 0 && (
                <>
                  <rect x={cx - barW / 2} y={y(d.minutes)} width={barW} height={h} rx={4} fill="var(--pine)" />
                  <text x={cx} y={y(d.minutes) - 4} textAnchor="middle" fontSize={10} fill="var(--muted)">
                    {d.minutes}
                  </text>
                </>
              )}
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fontSize={11}
                fill={i === days.length - 1 ? "var(--ink)" : "var(--muted)"}
                fontWeight={i === days.length - 1 ? 600 : 400}
              >
                {weekday(d.date, "short")}
              </text>
            </g>
          );
        })}
        {perDay !== null && (
          <line
            x1={0}
            x2={W}
            y1={y(perDay)}
            y2={y(perDay)}
            stroke="var(--marigold)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </svg>

      <p className="mt-2 text-[12px] text-muted">
        {weeklyGoal
          ? `Dashed line: ${Math.round(weeklyGoal / 7)} min a day keeps pace with your weekly goal.`
          : "Set a weekly movement goal below to see a pace line."}
      </p>
    </section>
  );
}

function weekday(iso: string, style: "short" | "long"): string {
  return fromIsoDate(iso).toLocaleDateString(undefined, { weekday: style });
}
