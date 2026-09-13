"use client";

import type { Entry } from "@/lib/supabase/database.types";

export function EntryList({
  entries,
  onRemove,
  removing,
}: {
  entries: readonly Entry[];
  onRemove: (id: string) => void;
  removing: string | null;
}) {
  return (
    <section className="card mt-4 p-5">
      <h2 className="font-display text-lg font-semibold">
        Eaten{" "}
        {entries.length > 0 && (
          <span className="text-[15px] font-normal text-muted">({entries.length})</span>
        )}
      </h2>

      {entries.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">Nothing logged for this day yet.</p>
      ) : (
        <ul className="mt-3 grid gap-1">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 border-b py-2 last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{entry.name}</p>
                <p className="text-[13px] text-muted">
                  {Math.round(Number(entry.protein_g))}p · {Math.round(Number(entry.carb_g))}c ·{" "}
                  {Math.round(Number(entry.fat_g))}f
                </p>
              </div>
              <span className="shrink-0 font-display text-[17px] font-semibold">
                {Math.round(entry.kcal).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                disabled={removing === entry.id}
                aria-label={`Remove ${entry.name}`}
                className="shrink-0 rounded-field text-muted"
                style={{ width: 44, height: 44 }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
