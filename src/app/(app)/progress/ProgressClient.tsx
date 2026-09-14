"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Movement, Profile, WeighIn } from "@/lib/supabase/database.types";
import { addDays, todayIso } from "@/lib/date";
import { lastSevenDays, weightStats, type WeightPoint } from "@/lib/trends";
import * as api from "@/lib/progress";
import { deleteWeighIn, saveWeighIn } from "@/lib/today";
import { WeightChart, type PaceLine } from "@/components/progress/WeightChart";
import { StatRow } from "@/components/progress/StatRow";
import { MovementBars } from "@/components/progress/MovementBars";
import { WeeklyReportCard } from "@/components/progress/WeeklyReportCard";
import { MeasurementsCard } from "@/components/progress/MeasurementsCard";
import { PhotosCard } from "@/components/progress/PhotosCard";
import { WeighInCard } from "@/components/today/WeighInCard";
import { ErrorNote } from "@/components/ErrorNote";
import { Icon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

type View = "overview" | "body";

/**
 * Client-side for the same reason as Today: "the last seven days" is a local
 * calendar range the server can't know. The profile arrives from the server.
 * Targets and data tools live in Settings; this tab is for looking back.
 */
export function ProgressClient({ userId, initialProfile }: { userId: string; initialProfile: Profile | null }) {
  const toast = useToast();
  const [today] = useState(() => todayIso());
  const profile = initialProfile;
  const [view, setView] = useState<View>("overview");
  const [weighIns, setWeighIns] = useState<WeighIn[] | null>(null);
  const [movement, setMovement] = useState<Movement[]>([]);
  const [weighing, setWeighing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.fetchWeighIns(), api.fetchMovementSince(addDays(today, -6))])
      .then(([w, m]) => {
        if (cancelled) return;
        setWeighIns(w);
        setMovement(m);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not load your progress.");
        setWeighIns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const points: WeightPoint[] = (weighIns ?? []).map((w) => ({ date: w.logged_on, weight: Number(w.weight_lb) }));
  const startWeight = profile?.start_weight == null ? null : Number(profile.start_weight);
  const goalWeight = profile?.goal_weight == null ? null : Number(profile.goal_weight);
  const todays = (weighIns ?? []).find((w) => w.logged_on === today) ?? null;

  const pace: PaceLine | null =
    startWeight !== null && goalWeight !== null && profile?.start_date && profile.goal_date && profile.goal_date > profile.start_date
      ? {
          start: { date: profile.start_date, weight: startWeight },
          goal: { date: profile.goal_date, weight: goalWeight },
        }
      : null;

  return (
    <>
      <Segmented
        label="Progress"
        value={view}
        onChange={setView}
        options={[
          { value: "overview", label: "Overview" },
          { value: "body", label: "Body" },
        ]}
      />

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {view === "overview" ? (
        <>
          <section className="card mt-3 p-4" aria-labelledby="weight-heading">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="weight-heading" className="t-section">
                Weight
              </h2>
              <button type="button" className="btn btn-quiet" style={{ minHeight: 40, paddingInline: 14 }} onClick={() => setWeighing(true)}>
                <Icon name="scale" size={17} />
                {todays ? "Edit today" : "Log weight"}
              </button>
            </div>
            {weighIns === null ? (
              <div aria-busy="true" className="rounded-field" style={{ height: 160, background: "var(--line)", opacity: 0.5 }}>
                <span className="sr-only">Loading weigh-ins…</span>
              </div>
            ) : (
              <WeightChart points={points} pace={pace} />
            )}
            <StatRow stats={weightStats(points, startWeight, goalWeight)} />
          </section>

          <WeeklyReportCard
            today={today}
            kcalTarget={profile?.kcal_target ?? null}
            proteinTarget={profile?.protein_target ?? null}
            waterGoalOz={profile?.water_goal_oz ?? 64}
          />

          <MovementBars days={lastSevenDays(movement, today)} weeklyGoal={profile?.weekly_movement_goal ?? null} />

          <Link href="/settings/targets" className="list mt-3 block">
            <span className="list-row">
              <span className="list-row-lead" aria-hidden="true">
                <Icon name="bolt" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Targets &amp; goals</span>
                <span className="t-meta block truncate">
                  {profile?.kcal_target ? `${profile.kcal_target.toLocaleString()} kcal a day` : "Not set yet"}
                  {goalWeight !== null ? ` · goal ${goalWeight} lb` : ""}
                </span>
              </span>
              <Icon name="chevron-right" size={18} className="shrink-0 text-muted" />
            </span>
          </Link>

          <Sheet open={weighing} onClose={() => setWeighing(false)} title="Today's weigh-in">
            <div className="in-sheet">
              <WeighInCard
                date={today}
                weighIn={todays}
                onSave={async (lb) => {
                  const saved = await saveWeighIn(userId, today, lb);
                  setWeighIns((list) =>
                    [...(list ?? []).filter((w) => w.logged_on !== today), saved].sort((a, b) => a.logged_on.localeCompare(b.logged_on)),
                  );
                  setWeighing(false);
                  toast({ message: `Weight saved · ${lb} lb` });
                }}
                onRemove={async (id) => {
                  await deleteWeighIn(id);
                  setWeighIns((list) => (list ?? []).filter((w) => w.id !== id));
                  setWeighing(false);
                  toast({ message: "Weigh-in removed" });
                }}
              />
            </div>
          </Sheet>
        </>
      ) : (
        <>
          <MeasurementsCard userId={userId} today={today} />
          <PhotosCard userId={userId} today={today} />
        </>
      )}
    </>
  );
}
