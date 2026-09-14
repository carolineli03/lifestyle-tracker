"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Food, MealSlot, Profile } from "@/lib/supabase/database.types";
import { addDays, describeDate, isFuture, todayIso, type IsoDate } from "@/lib/date";
import { sumMacros, type MacroTotals, type Targets } from "@/lib/totals";
import { sumNutrients } from "@/lib/nutrients";
import { currentStreak } from "@/lib/report";
import { defaultMeal, SECTION_LABEL } from "@/lib/meals";
import * as api from "@/lib/today";
import { TodayHero } from "@/components/today/TodayHero";
import { QuickTiles } from "@/components/today/QuickTiles";
import { MealList } from "@/components/today/MealList";
import { LogFood } from "@/components/today/LogFood";
import { ErrorNote } from "@/components/ErrorNote";
import { SettingsLink } from "@/components/PageHeader";
import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

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
  const [error, setError] = useState<string | null>(null);
  const [loggedDays, setLoggedDays] = useState<IsoDate[]>([]);
  const [logMeal, setLogMeal] = useState<MealSlot | null>(null);
  const [logSession, setLogSession] = useState(0);
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();

  // The centre + in the tab bar links here with ?log=1: open the log sheet,
  // then drop the flag so a refresh doesn't reopen it.
  useEffect(() => {
    if (params.get("log") === "1") {
      setLogSession((n) => n + 1);
      setLogMeal(defaultMeal());
      router.replace("/today", { scroll: false });
    }
  }, [params, router]);

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



  const streak = currentStreak(loggedDays, todayIso());

  return (
    <>
      <header className="mb-3 flex items-center gap-1">
        <button type="button" className="icon-btn -ml-2" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          <Icon name="chevron-left" size={22} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="t-section">{describeDate(date, todayIso())}</h1>
          {date !== todayIso() ? (
            <button type="button" className="t-meta font-semibold" style={{ color: "var(--pine)", minHeight: 0 }} onClick={() => setDate(todayIso())}>
              Back to today
            </button>
          ) : (
            streak >= 2 && (
              <p className="t-meta">
                <Icon name="flame" size={12} className="mr-1 inline align-[-1px]" />
                {streak}-day streak
              </p>
            )
          )}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Next day"
          disabled={isFuture(addDays(date, 1), todayIso())}
          style={isFuture(addDays(date, 1), todayIso()) ? { opacity: 0.3 } : undefined}
        >
          <Icon name="chevron-right" size={22} />
        </button>
        <SettingsLink />
      </header>

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {loading && !day ? (
        <Skeleton />
      ) : (
        <>
          <TodayHero
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
          />

          <QuickTiles
            date={date}
            water={day?.water ?? []}
            waterGoalOz={profile?.water_goal_oz ?? 64}
            weekMovement={day?.weekMovement ?? []}
            weeklyGoal={profile?.weekly_movement_goal ?? null}
            weighIn={day?.weighIn ?? null}
            onAddWater={async (oz) => {
              const id = await api.addWater(userId, date, oz);
              await reloadDay(date);
              return id;
            }}
            onUndoWater={async (id) => {
              await api.deleteWater(id);
              await reloadDay(date);
            }}
            onAddMovement={async (kind, minutes) => {
              await api.addMovement(userId, date, kind, minutes, day?.latestWeightLb ?? null);
              await reloadDay(date);
            }}
            onRemoveMovement={async (id) => {
              await api.deleteMovement(id);
              await reloadDay(date);
            }}
            onSaveWeight={async (lb) => {
              await api.saveWeighIn(userId, date, lb);
              await reloadDay(date);
            }}
            onRemoveWeight={async (id) => {
              await api.deleteWeighIn(id);
              await reloadDay(date);
            }}
          />

          <div className="mb-1 mt-6 flex items-center justify-between px-1">
            <h2 className="t-label">Meals</h2>
            <span className="t-meta">{Math.round(eaten.kcal).toLocaleString()} kcal</span>
          </div>
          <MealList
            date={date}
            entries={day?.entries ?? []}
            onAdd={(meal) => setLogMeal(meal)}
            onRemove={async (id) => {
              await api.deleteEntry(id);
              await reloadDay(date);
            }}
            onCopy={async (fromDate, fromMeal, toMeal) => {
              const n = await api.copyMealFrom(userId, fromDate, fromMeal, date, toMeal);
              if (n > 0) await reloadDay(date);
              return n;
            }}
          />
        </>
      )}

      <Sheet
        open={logMeal !== null}
        onClose={() => setLogMeal(null)}
        title={date === todayIso() ? "Log food" : `Log food · ${describeDate(date, todayIso())}`}
      >
        {logMeal && (
          <div className="in-sheet">
            <LogFood
              key={`${logMeal}-${logSession}`}
              foods={foods}
              busy={busy}
              initialMeal={logMeal}
              onConfirm={async (items) => {
                await confirmEntries(items);
                const meal = items[0]?.meal;
                toast({
                  message: `Added ${items.length === 1 ? items[0]!.name : `${items.length} items`}${meal ? ` to ${SECTION_LABEL[meal].toLowerCase()}` : ""}`,
                });
                setLogMeal(null);
              }}
            />
          </div>
        )}
      </Sheet>
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid grid-cols-1 gap-4">
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
