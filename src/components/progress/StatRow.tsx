import type { WeightStats } from "@/lib/trends";
import { fmt } from "./WeightChart";

export function StatRow({ stats }: { stats: WeightStats }) {
  const { latest, change, toGo } = stats;

  return (
    <dl className="mt-4 grid grid-cols-3 gap-2">
      <Stat label="Latest" value={latest ? `${fmt(latest.weight)}` : "—"} unit={latest ? "lb" : undefined} />
      <Stat
        label="Change"
        value={change === null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : ""}${fmt(Math.abs(change))}`}
        unit={change === null ? undefined : "lb"}
      />
      <Stat
        label="To goal"
        value={toGo === null ? "—" : toGo <= 0 ? "Reached" : fmt(toGo)}
        unit={toGo !== null && toGo > 0 ? "lb" : undefined}
        tone={toGo !== null && toGo <= 0 ? "var(--pine)" : undefined}
      />
    </dl>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="rounded-field px-3 py-2.5" style={{ background: "var(--pine-wash)" }}>
      <dt className="text-[12px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 mt-0.5 font-display text-[22px] font-bold leading-tight" style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="ml-0.5 font-sans text-[12px] font-semibold text-muted">{unit}</span>}
      </dd>
    </div>
  );
}
