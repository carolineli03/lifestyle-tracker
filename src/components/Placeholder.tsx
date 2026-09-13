/**
 * Stands in for a tab that is scaffolded but not yet built. Deliberately
 * plain — it should read as "not here yet", not as a broken feature.
 */
export function Placeholder({ what, phase }: { what: string; phase: string }) {
  return (
    <div className="card p-5">
      <p className="text-[15px] text-ink">{what}</p>
      <p className="mt-2 text-[13px] text-muted">Arriving in {phase}.</p>
    </div>
  );
}
