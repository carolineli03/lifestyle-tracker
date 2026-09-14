"use client";

import { useCallback, useEffect, useState } from "react";
import type { Food, Profile } from "@/lib/supabase/database.types";
import { todayIso, type IsoDate } from "@/lib/date";
import { sumMacros, type MacroTotals, type Targets } from "@/lib/totals";
import * as api from "@/lib/today";
import { DateStepper } from "@/components/today/DateStepper";
import { CalorieHero } from "@/components/today/CalorieHero";
import { LogFood } from "@/components/today/LogFood";
import { EntryList } from "@/components/today/EntryList";
import { MovementCard } from "@/components/today/MovementCard";
import { WeighInCard } from "@/components/today/WeighInCard";
import { ErrorNote } from "@/components/ErrorNote";

/**
 * The Today tab runs on the client rather than as a server component, and the
 * reason is timezones. `logged_on` is a local calendar day; the server has no
 * idea which day that is for whoever is holding the phone. Rendering it here
 * means "today" is always the user's today, with no flash of the UTC date and
 * no entries quietly filed under tomorrow after 5pm.
 *
 * Targets come from the server, since a profile has nothing to do with dates.
 */
export function TodayClient({ userId, profile }: { userId: string; profile: Profile | null }) {
  const [date, setDate] = useState<IsoDate>(() => todayIso());
  const [day, setDay] = useState<api.DayData | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removingEntry, setRemovingEntry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targets: Targets = {
    kcal: profile?.kcal_target ?? null,
    protein: profile?.protein_target ?? null,
    carb: profile?.carb_target ?? null,
    fat: profile?.fat_target ?? null,
  };

  const reloadDay = useCallback(async (which: IsoDate) => {
    const data = await api.fetchDay(which);
    setDay(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .fetchDay(date)
      .then((data) => {
        if (!cancelled) setDay(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load this day.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  // The food library does not change with the date, so it is fetched once and
  // then kept in sync locally as entries are confirmed.
  useEffect(() => {
    let cancelled = false;
    api
      .fetchFoods()
      .then((data) => {
        if (!cancelled) setFoods(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load saved foods.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eaten: MacroTotals = sumMacros(
    (day?.entries ?? []).map((e) => ({
      kcal: Number(e.kcal),
      protein_g: Number(e.protein_g),
      carb_g: Number(e.carb_g),
      fat_g: Number(e.fat_g),
    })),
  );

  async function confirmEntries(
    items: ReadonlyArray<{ name: string; macros: MacroTotals; perServing: MacroTotals; remember: boolean }>,
  ): Promise<void> {
    setBusy(true);
    try {
      // Sequential on purpose: each call may upsert into `foods`, and two
      // concurrent upserts of the same new food would race on the unique index.
      for (const item of items) {
        await api.logEntry(date, item.name, item.macros, item.remember, item.perServing);
      }
      await Promise.all([reloadDay(date), api.fetchFoods().then(setFoods)]);
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string): Promise<void> {
    setRemovingEntry(id);
    setError(null);
    try {
      await api.deleteEntry(id);
      await reloadDay(date);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove that entry.");
    } finally {
      setRemovingEntry(null);
    }
  }

  return (
    <>
      <DateStepper date={date} onChange={setDate} />

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {loading && !day ? (
        <Skeleton />
      ) : (
        <>
          <CalorieHero eaten={eaten} targets={targets} />

          <LogFood foods={foods} onConfirm={confirmEntries} busy={busy} />

          <EntryList
            entries={day?.entries ?? []}
            onRemove={(id) => void removeEntry(id)}
            removing={removingEntry}
          />

          <MovementCard
            date={date}
            weekMovement={day?.weekMovement ?? []}
            weeklyGoal={profile?.weekly_movement_goal ?? null}
            onAdd={async (kind, minutes) => {
              await api.addMovement(userId, date, kind, minutes);
              await reloadDay(date);
            }}
            onRemove={async (id) => {
              await api.deleteMovement(id);
              await reloadDay(date);
            }}
          />

          <WeighInCard
            date={date}
            weighIn={day?.weighIn ?? null}
            onSave={async (lb) => {
              await api.saveWeighIn(userId, date, lb);
              await reloadDay(date);
            }}
            onRemove={async (id) => {
              await api.deleteWeighIn(id);
              await reloadDay(date);
            }}
          />
        </>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-4">
      <span className="sr-only">Loading your day…</span>
      {[140, 220, 120].map((h, i) => (
        <div
          key={i}
          className="card"
          style={{ height: h, background: "var(--line)", borderColor: "transparent", opacity: 0.5 }}
        />
      ))}
    </div>
  );
}
