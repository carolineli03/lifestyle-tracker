import { fromIsoDate, type IsoDate } from "@/lib/date";
import { daysUntil } from "@/lib/expiry";
import type { WeightPoint } from "@/lib/trends";

/**
 * Weigh-ins as a solid line, the goal pace as a dashed one. Inline SVG, no
 * charting library: two polylines and four labels do not need one.
 */

const W = 340;
const H = 190;
const PAD = { top: 12, right: 10, bottom: 24, left: 38 };

export type PaceLine = { start: WeightPoint; goal: WeightPoint };

export function WeightChart({ points, pace }: { points: readonly WeightPoint[]; pace: PaceLine | null }) {
  if (points.length === 0) {
    return (
      <div
        className="grid grid-cols-1 place-items-center rounded-field text-center text-[14px] text-muted"
        style={{ height: 160, background: "var(--pine-wash)" }}
      >
        <p className="px-6">No weigh-ins yet. Add one on the Today tab and the line starts here.</p>
      </div>
    );
  }

  const dates = points.map((p) => p.date);
  const weights = points.map((p) => p.weight);
  if (pace) {
    dates.push(pace.start.date, pace.goal.date);
    weights.push(pace.start.weight, pace.goal.weight);
  }

  const first = dates.reduce((a, b) => (a < b ? a : b));
  const last = dates.reduce((a, b) => (a > b ? a : b));
  const span = Math.max(1, daysUntil(last, first));

  const yMin = Math.floor(Math.min(...weights) - 1.5);
  const yMax = Math.ceil(Math.max(...weights) + 1.5);

  const x = (d: IsoDate): number =>
    PAD.left + (daysUntil(d, first) / span) * (W - PAD.left - PAD.right);
  const y = (w: number): number =>
    PAD.top + ((yMax - w) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const line = points.map((p) => `${x(p.date).toFixed(1)},${y(p.weight).toFixed(1)}`).join(" ");
  const latest = points[points.length - 1]!;
  const showDots = points.length <= 45;

  const summary =
    `Weight chart: ${points.length} weigh-in${points.length === 1 ? "" : "s"} from ` +
    `${shortDate(points[0]!.date)} to ${shortDate(latest.date)}, latest ${fmt(latest.weight)} lb.` +
    (pace ? ` Goal pace runs from ${fmt(pace.start.weight)} lb to ${fmt(pace.goal.weight)} lb by ${shortDate(pace.goal.date)}.` : "");

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} style={{ display: "block" }}>
        {/* y gridlines at the extremes only — the stat row carries the detail */}
        {[yMax, yMin].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular-nums">
              {v}
            </text>
          </g>
        ))}

        <text x={PAD.left} y={H - 6} fontSize={11} fill="var(--muted)">
          {shortDate(first)}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor="end">
          {shortDate(last)}
        </text>

        {pace && (
          <line
            x1={x(pace.start.date)}
            y1={y(pace.start.weight)}
            x2={x(pace.goal.date)}
            y2={y(pace.goal.weight)}
            stroke="var(--marigold)"
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
        )}

        {points.length > 1 && (
          <polyline
            points={line}
            fill="none"
            stroke="var(--pine)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {showDots &&
          points.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.weight)} r={2.5} fill="var(--pine)" />
          ))}
        <circle cx={x(latest.date)} cy={y(latest.weight)} r={4.5} fill="var(--pine)" stroke="var(--card)" strokeWidth={2} />
      </svg>

      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <Legend color="var(--pine)" label="Weigh-ins" />
        {pace ? (
          <Legend color="var(--marigold)" label="Goal pace" dashed />
        ) : (
          <span>Set a start and goal below to see the pace line.</span>
        )}
      </figcaption>
    </figure>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden="true">
        <line x1="1" x2="17" y1="3" y2="3" stroke={color} strokeWidth={2.5} strokeDasharray={dashed ? "4 3" : undefined} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

function shortDate(iso: IsoDate): string {
  return fromIsoDate(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
