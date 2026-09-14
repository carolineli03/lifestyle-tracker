"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Household, Profile } from "@/lib/supabase/database.types";
import { Icon } from "@/components/ui/icons";
import { ListRow, SectionTitle } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountCard } from "@/components/AccountCard";
import { AiUsageCard } from "@/components/progress/AiUsageCard";
import { ExportCard } from "@/components/progress/ExportCard";

/** Everything that isn't daily use: goals, the shared kitchen, account, appearance, data. */
export function SettingsClient({
  household,
  members,
  isGuest,
  email,
  profile,
}: {
  household: Household;
  members: number;
  isGuest: boolean;
  email: string | null;
  profile: Profile | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const kcal = profile?.kcal_target;
  const targetSummary = kcal
    ? `${kcal.toLocaleString()} kcal · ${profile?.protein_target ?? "–"}p ${profile?.carb_target ?? "–"}c ${profile?.fat_target ?? "–"}f`
    : "Not set yet";

  async function copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(household.join_code);
      setCopied(true);
      toast({ message: `Code ${household.join_code} copied` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ message: `Code: ${household.join_code}` });
    }
  }

  return (
    <>
      <header className="mb-2 flex items-center gap-1">
        <button type="button" className="icon-btn -ml-2" onClick={() => router.back()} aria-label="Back">
          <Icon name="chevron-left" size={24} />
        </button>
        <h1 className="t-title">Settings</h1>
      </header>

      <SectionTitle>Goals</SectionTitle>
      <div className="list">
        <Link href="/settings/targets" className="list-row">
          <span className="list-row-lead" aria-hidden="true">
            <Icon name="flame" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px]">Daily targets &amp; goals</span>
            <span className="t-meta block truncate">{targetSummary}</span>
          </span>
          <Icon name="chevron-right" size={18} className="text-muted" />
        </Link>
        <Link href="/settings/targets?tab=manual" className="list-row">
          <span className="list-row-lead" aria-hidden="true">
            <Icon name="water" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px]">Water, nutrients &amp; exercise</span>
            <span className="t-meta block truncate">
              {profile?.water_goal_oz ?? 64} oz water · exercise add-back {profile?.eat_back_exercise ? "on" : "off"}
            </span>
          </span>
          <Icon name="chevron-right" size={18} className="text-muted" />
        </Link>
      </div>

      <SectionTitle>Kitchen</SectionTitle>
      <div className="list">
        <ListRow icon="fridge" title={household.name} subtitle={`${members} ${members === 1 ? "person" : "people"} share this kitchen`} />
        <div className="list-row">
          <span className="min-w-0 flex-1">
            <span className="t-meta block">Invite code: the other person picks &ldquo;Join with a code&rdquo;</span>
            <span className="font-display text-[26px] font-bold tracking-[0.3em]">{household.join_code}</span>
          </span>
          <button type="button" className="btn btn-quiet" onClick={() => void copyCode()}>
            <Icon name={copied ? "check" : "copy"} size={18} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <SectionTitle>Account</SectionTitle>
      <div className="-mt-4">
        <AccountCard isGuest={isGuest} email={email} />
      </div>

      <SectionTitle>Appearance</SectionTitle>
      <div className="list">
        <div className="list-row justify-between">
          <span className="text-[15px]">Theme</span>
          <ThemeToggle />
        </div>
      </div>

      <SectionTitle>Your data</SectionTitle>
      <div className="-mt-4">
        <AiUsageCard />
        <ExportCard />
      </div>
    </>
  );
}
