"use client";

import { useState } from "react";
import type { Entry, MealSlot } from "@/lib/supabase/database.types";
import { groupByMeal, SECTION_LABEL, type SectionKey } from "@/lib/meals";
import { addDays, describeDate, type IsoDate } from "@/lib/date";
import { MEAL_SLOTS } from "@/lib/planner";
import { Icon, type IconName } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ErrorNote } from "@/components/ErrorNote";

const MEAL_ICON: Record<SectionKey, IconName> = {
  breakfast: "flame",
  lunch: "leaf",
  dinner: "calendar",
  snack: "bolt",
  other: "more",
};

/**
 * The day's food as four meal cards. Each has a + that opens the log sheet
 * preset to that meal; items open a detail sheet; "⋯" copies an earlier meal.
 */
export function MealList({
  date,
  entries,
  onAdd,
  onRemove,
  onCopy,
}: {
  date: IsoDate;
  entries: readonly Entry[];
  onAdd: (meal: MealSlot) => void;
  onRemove: (id: string) => Promise<void>;
  onCopy: (fromDate: IsoDate, fromMeal: MealSlot, toMeal: MealSlot) => Promise<number>;
}) {
  const toast = useToast();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [copyInto, setCopyInto] = useState<MealSlot | null>(null);
  const [removing, setRemoving] = useState(false);
  const sections = groupByMeal(entries);

  return (
    <>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {sections.map((section) => {
          const key = section.key;
          const empty = section.entries.length === 0;
          return (
            <section key={key} className="card overflow-hidden" aria-label={SECTION_LABEL[key]}>
              <div className="flex items-center gap-2 py-1.5 pl-3 pr-1.5">
                <span className="list-row-lead" style={{ width: 32, height: 32, borderRadius: 10 }} aria-hidden="true">
                  <Icon name={MEAL_ICON[key]} size={16} />
                </span>
                <h2 className="min-w-0 flex-1 text-[15px] font-semibold">
                  {SECTION_LABEL[key]}
                  {empty && key !== "other" && <span className="t-meta ml-2 font-normal">Nothing yet</span>}
                </h2>
                {!empty && <span className="text-[15px] font-semibold tabular-nums">{section.kcal.toLocaleString()}</span>}
                {key !== "other" && (
                  <>
                    <button type="button" className="icon-btn text-muted" onClick={() => setCopyInto(key)} aria-label={`Copy an earlier meal into ${SECTION_LABEL[key]}`}>
                      <Icon name="copy" size={18} />
                    </button>
                    <button type="button" className="icon-btn icon-btn-soft" onClick={() => onAdd(key)} aria-label={`Add food to ${SECTION_LABEL[key]}`}>
                      <Icon name="plus" size={20} strokeWidth={2.2} />
                    </button>
                  </>
                )}
              </div>
              {!empty && (
                <ul className="border-t" style={{ borderColor: "var(--line)" }}>
                  {section.entries.map((e) => (
                    <li key={e.id} className="border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
                      <button type="button" className="list-row" style={{ minHeight: 52 }} onClick={() => setEntry(e)}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">{e.name}</span>
                          <span className="t-meta block">
                            {Math.round(Number(e.protein_g))}p · {Math.round(Number(e.carb_g))}c · {Math.round(Number(e.fat_g))}f
                          </span>
                        </span>
                        <span className="shrink-0 text-[15px] tabular-nums">{Math.round(e.kcal).toLocaleString()}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Sheet open={entry !== null} onClose={() => setEntry(null)} title={entry?.name ?? ""}>
        {entry && (
          <>
            <dl className="grid grid-cols-4 gap-2 text-center">
              {[
                ["kcal", Math.round(entry.kcal)],
                ["Protein", `${Math.round(Number(entry.protein_g))}g`],
                ["Carbs", `${Math.round(Number(entry.carb_g))}g`],
                ["Fat", `${Math.round(Number(entry.fat_g))}g`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-field px-2 py-2.5" style={{ background: "var(--pine-wash)" }}>
                  <dt className="t-meta">{k}</dt>
                  <dd className="m-0 font-display text-[18px] font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            {(entry.fiber_g !== null || entry.sugar_g !== null || entry.sodium_mg !== null) && (
              <p className="t-meta mt-3 text-center">
                {entry.fiber_g !== null && `Fiber ${Number(entry.fiber_g)}g`}
                {entry.sugar_g !== null && ` · Sugar ${Number(entry.sugar_g)}g`}
                {entry.sodium_mg !== null && ` · Sodium ${Number(entry.sodium_mg)}mg`}
              </p>
            )}
            <p className="t-meta mt-3 text-center">{entry.meal ? SECTION_LABEL[entry.meal] : "No meal"} · {describeDate(entry.logged_on)}</p>
            <button
              type="button"
              className="btn btn-quiet mt-5 w-full"
              style={{ color: "var(--tomato)" }}
              disabled={removing}
              onClick={async () => {
                setRemoving(true);
                try {
                  await onRemove(entry.id);
                  toast({ message: `Removed ${entry.name}` });
                  setEntry(null);
                } catch (cause) {
                  toast({ message: cause instanceof Error ? cause.message : "That didn't remove." });
                } finally {
                  setRemoving(false);
                }
              }}
            >
              <Icon name="trash" size={18} />
              {removing ? "Removing…" : "Remove from log"}
            </button>
          </>
        )}
      </Sheet>

      <CopySheet
        date={date}
        toMeal={copyInto}
        onClose={() => setCopyInto(null)}
        onCopy={async (from, fromMeal, toMeal) => {
          const n = await onCopy(from, fromMeal, toMeal);
          if (n > 0) toast({ message: `Copied ${n} ${n === 1 ? "item" : "items"} into ${SECTION_LABEL[toMeal].toLowerCase()}` });
          return n;
        }}
      />
    </>
  );
}

function CopySheet({
  date,
  toMeal,
  onClose,
  onCopy,
}: {
  date: IsoDate;
  toMeal: MealSlot | null;
  onClose: () => void;
  onCopy: (fromDate: IsoDate, fromMeal: MealSlot, toMeal: MealSlot) => Promise<number>;
}) {
  const [from, setFrom] = useState<IsoDate>(() => addDays(date, -1));
  const [fromMeal, setFromMeal] = useState<MealSlot>("breakfast");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOpened, setLastOpened] = useState<MealSlot | null>(null);

  // Reset to "yesterday, same meal" each time the sheet opens for a meal.
  if (toMeal !== lastOpened) {
    setLastOpened(toMeal);
    if (toMeal) {
      setFrom(addDays(date, -1));
      setFromMeal(toMeal);
      setNote(null);
      setError(null);
    }
  }

  return (
    <Sheet
      open={toMeal !== null}
      onClose={onClose}
      title={toMeal ? `Copy into ${SECTION_LABEL[toMeal].toLowerCase()}` : ""}
      footer={
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={busy || !from || !toMeal}
          onClick={async () => {
            if (!toMeal) return;
            setBusy(true);
            setError(null);
            try {
              const n = await onCopy(from, fromMeal, toMeal);
              if (n === 0) setNote(`Nothing was logged for ${SECTION_LABEL[fromMeal].toLowerCase()} on ${describeDate(from, date)}.`);
              else onClose();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "That didn't copy.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Copying…" : "Copy"}
        </button>
      }
    >
      <p className="t-meta">Re-log a meal you&rsquo;ve eaten before.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="t-meta font-semibold">From day</span>
          <input type="date" className="field" value={from} max={date} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="t-meta font-semibold">Meal</span>
          <select className="field" value={fromMeal} onChange={(e) => setFromMeal(e.target.value as MealSlot)}>
            {MEAL_SLOTS.map((m) => (
              <option key={m} value={m}>
                {SECTION_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {note && (
        <p className="mt-3 text-[14px] text-muted" role="status">
          {note}
        </p>
      )}
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
    </Sheet>
  );
}
