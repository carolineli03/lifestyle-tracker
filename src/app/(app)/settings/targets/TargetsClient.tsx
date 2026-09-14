"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Profile } from "@/lib/supabase/database.types";
import * as api from "@/lib/progress";
import { Icon } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { TargetCalculator } from "@/components/progress/TargetCalculator";
import { TargetOverrides } from "@/components/progress/TargetOverrides";

type Mode = "calculate" | "manual";

export function TargetsClient({
  userId,
  initialProfile,
  latestWeight,
}: {
  userId: string;
  initialProfile: Profile | null;
  latestWeight: number | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [profile, setProfile] = useState(initialProfile);
  const [mode, setMode] = useState<Mode>(params.get("tab") === "manual" ? "manual" : "calculate");

  async function save(patch: api.ProfilePatch): Promise<void> {
    const updated = await api.saveProfile(userId, patch);
    setProfile(updated);
    toast({ message: "Targets saved" });
    router.refresh();
  }

  return (
    <>
      <header className="mb-3 flex items-center gap-1">
        <button type="button" className="icon-btn -ml-2" onClick={() => router.back()} aria-label="Back">
          <Icon name="chevron-left" size={24} />
        </button>
        <h1 className="t-title">Targets &amp; goals</h1>
      </header>

      <Segmented
        label="How to set targets"
        value={mode}
        onChange={setMode}
        options={[
          { value: "calculate", label: "Calculate for me" },
          { value: "manual", label: "Set by hand" },
        ]}
      />

      {mode === "calculate" ? (
        <TargetCalculator profile={profile} latestWeight={latestWeight} onSave={save} />
      ) : (
        <TargetOverrides profile={profile} onSave={save} />
      )}
    </>
  );
}
