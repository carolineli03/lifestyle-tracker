"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Movement, Profile, WeighIn } from "@/lib/supabase/database.types";
import { addDays, todayIso } from "@/lib/date";
import { lastSevenDays, weightStats, type WeightPoint } from "@/lib/trends";
import * as api from "@/lib/progress";
import { WeightChart, type PaceLine } from "@/components/progress/WeightChart";
import { StatRow } from "@/components/progress/StatRow";
import { MovementBars } from "@/components/progress/MovementBars";
import { TargetCalculator } from "@/components/progress/TargetCalculator";
import { TargetOverrides } from "@/components/progress/TargetOverrides";
import { AiUsageCard } from "@/components/progress/AiUsageCard";
import { WeeklyReportCard } from "@/components/progress/WeeklyReportCard";
import { MeasurementsCard } from "@/components/progress/MeasurementsCard";
import { PhotosCard } from "@/components/progress/PhotosCard";
import { ExportCard } from "@/components/progress/ExportCard";
import { ErrorNote } from "@/components/ErrorNote";

/**
 * Client-side for the same reason as Today: "the last seven days" is a local
 * calendar range the server can't know. The profile arrives from the server.
 */
export function ProgressClient({ userId, initialProfile }: { userId: string; initialProfile: Profile | null }) {
  const router = useRouter();
  const [today] = useState(() => todayIso());
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [weighIns, setWeighIns] = useState<WeighIn[] | null>(null);
  const [movement, setMovement] = useState<Movement[]>([]);
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

  async function save(patch: api.ProfilePatch): Promise<void> {
    const updated = await api.saveProfile(userId, patch);
    setProfile(updated);
    // Today reads targets on the server; drop the cached render so the new
    // numbers show up there without a hard reload.
    router.refresh();
  }

  const points: WeightPoint[] = (weighIns ?? []).map((w) => ({ date: w.logged_on, weight: Number(w.weight_lb) }));
  const startWeight = profile?.start_weight == null ? null : Number(profile.start_weight);
  const goalWeight = profile?.goal_weight == null ? null : Number(profile.goal_weight);

  const pace: PaceLine | null =
    startWeight !== null && goalWeight !== null && profile?.start_date && profile.goal_date && profile.goal_date > profile.start_date
      ? {
          start: { date: profile.start_date, weight: startWeight },
          goal: { date: profile.goal_date, weight: goalWeight },
        }
      : null;

  const latestWeight = points.length > 0 ? points[points.length - 1]!.weight : null;

  return (
    <>
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      <section className="card p-5" aria-labelledby="weight-heading">
        <h2 id="weight-heading" className="mb-3 font-display text-lg font-semibold">
          Weight
        </h2>
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

      <MeasurementsCard userId={userId} today={today} />

      <PhotosCard userId={userId} today={today} />

      {/* Keyed on the loaded weight so the calculator prefills once it arrives. */}
      <TargetCalculator
        key={weighIns === null ? "loading" : `w-${latestWeight ?? "none"}`}
        profile={profile}
        latestWeight={latestWeight}
        onSave={save}
      />

      {/* Re-seeded after any save so a calculator result shows up in the fields. */}
      <TargetOverrides key={profile?.updated_at ?? "none"} profile={profile} onSave={save} />

      <AiUsageCard />

      <ExportCard />
    </>
  );
}
