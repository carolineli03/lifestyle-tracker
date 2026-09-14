"use client";

import { useCallback, useEffect, useState } from "react";
import type { Food, Profile } from "@/lib/supabase/database.types";
import { addDays, todayIso, type IsoDate } from "@/lib/date";
import { sumMacros, type MacroTotals, type Targets } from "@/lib/totals";
import { sumNutrients } from "@/lib/nutrients";
import { currentStreak } from "@/lib/report";
import * as api from "@/lib/today";
import { DateStepper } from "@/components/today/DateStepper";
import { CalorieHero } from "@/components/today/CalorieHero";
import { LogFood } from "@/components/today/LogFood";
import { MealSections } from "@/components/today/MealSections";
import { WaterCard } from "@/components/today/WaterCard";
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
  const [loggedDays, setLoggedDays] = useState<IsoDate[]>([]);

  const targets: Targets = {
    kcal: profile?.kcal_target ?? null,
    protein: profile?.protein_target ?? null,
    carb: profile?.carb_target ?? null,
    fat: profile?.fat_target ?? null,
  };

  const reloadStreak = useCallback(async () => {
    setLoggedDays(await api.fetchLoggedDays(addDays(todayIso(), -400)));
  }, []);

  const reloadDay = useCallback(
    async (which: IsoDate) => {
      const data = await api.fetchDay(which);
      setDay(data);
      await reloadStreak();
    },
    [reloadStreak],
  );

  useEffect(() => {
    reloadStreak().catch(() => undefined);
  }, [reloadStreak]);

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

  const nutrients = sumNutrients(day?.entries ?? []);
  const exerciseKcal = (day?.weekMovement ?? []).filter((m) => m.logged_on === date).reduce((s, m) => s + (m.kcal ?? 0), 0);

  async function confirmEntries(items: readonly api.LogInput[]): Promise<void> {
    setBusy(true);
    try {
      // Sequential on purpose: each call may upsert into `foods`, and two
      // concurrent upserts of the same new food would race on the unique index.
      for (const item of items) {
        await api.logEntry(date, item);
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
          <CalorieHero
            eaten={eaten}
            targets={targets}
            exerciseKcal={exerciseKcal}
            eatBack={profile?.eat_back_exercise ?? false}
            nutrients={nutrients}
            nutrientGoals={{
              fiber: profile?.fiber_target ?? null,
              sugar: profile?.sugar_limit ?? null,
              sodium: profile?.sodium_limit ?? null,
            }}
            streak={currentStreak(loggedDays, todayIso())}
          />

          <LogFood foods={foods} onConfirm={confirmEntries} busy={busy} />

          <MealSections
            date={date}
            entries={day?.entries ?? []}
            onRemove={(id) => void removeEntry(id)}
            removing={removingEntry}
            onCopy={async (fromDate, fromMeal, toMeal) => {
              const n = await api.copyMealFrom(userId, fromDate, fromMeal, date, toMeal);
              if (n > 0) await reloadDay(date);
              return n;
            }}
          />

          <WaterCard
            logs={day?.water ?? []}
            goalOz={profile?.water_goal_oz ?? 64}
            onAdd={async (oz) => {
              await api.addWater(userId, date, oz);
              await reloadDay(date);
            }}
            onUndo={async (id) => {
              await api.deleteWater(id);
              await reloadDay(date);
            }}
          />

          <MovementCard
            date={date}
            weekMovement={day?.weekMovement ?? []}
            weeklyGoal={profile?.weekly_movement_goal ?? null}
            onAdd={async (kind, minutes) => {
              await api.addMovement(userId, date, kind, minutes, day?.latestWeightLb ?? null);
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
