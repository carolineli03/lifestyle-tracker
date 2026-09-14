"use client";

import { useState } from "react";
import type { Movement, WaterLog, WeighIn } from "@/lib/supabase/database.types";
import type { IsoDate } from "@/lib/date";
import { Icon } from "@/components/ui/icons";
import { Ring } from "@/components/ui/Ring";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { progressFraction } from "@/lib/totals";
import { WaterCard } from "./WaterCard";
import { MovementCard } from "./MovementCard";
import { WeighInCard } from "./WeighInCard";

/**
 * Water, movement and weight as three glanceable tiles. Tapping water adds a
 * glass straight away (with Undo); the others open their controls in a sheet.
 */
export function QuickTiles({
  date,
  water,
  waterGoalOz,
  weekMovement,
  weeklyGoal,
  weighIn,
  onAddWater,
  onUndoWater,
  onAddMovement,
  onRemoveMovement,
  onSaveWeight,
  onRemoveWeight,
}: {
  date: IsoDate;
  water: readonly WaterLog[];
  waterGoalOz: number;
  weekMovement: readonly Movement[];
  weeklyGoal: number | null;
  weighIn: WeighIn | null;
  /** Resolves to the new entry's id. */
  onAddWater: (oz: number) => Promise<string>;
  onUndoWater: (id: string) => Promise<void>;
  onAddMovement: (kind: string, minutes: number) => Promise<void>;
  onRemoveMovement: (id: string) => Promise<void>;
  onSaveWeight: (lb: number) => Promise<void>;
  onRemoveWeight: (id: string) => Promise<void>;
}) {
  const toast = useToast();
  const [sheet, setSheet] = useState<"water" | "move" | "weight" | null>(null);
  const [adding, setAdding] = useState(false);

  const waterOz = Math.round(water.reduce((s, w) => s + Number(w.amount_oz), 0));
  const todayMoves = weekMovement.filter((m) => m.logged_on === date);
  const minutes = todayMoves.reduce((s, m) => s + m.minutes, 0);
  const kcal = todayMoves.reduce((s, m) => s + (m.kcal ?? 0), 0);
  const weekMinutes = weekMovement.reduce((s, m) => s + m.minutes, 0);

  async function glass(): Promise<void> {
    setAdding(true);
    try {
      const id = await onAddWater(8);
      toast({
        message: `+8 oz water · ${waterOz + 8} oz today`,
        action: { label: "Undo", onAction: () => onUndoWater(id) },
      });
    } catch (cause) {
      toast({ message: cause instanceof Error ? cause.message : "That didn't save." });
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="tile relative">
          <button type="button" className="absolute inset-0 rounded-card" onClick={() => void glass()} disabled={adding} aria-label={`Add 8 ounces of water. ${waterOz} of ${waterGoalOz} today.`} />
          <div className="pointer-events-none flex w-full items-start justify-between">
            <Ring size={40} stroke={5} fraction={progressFraction(waterOz, waterGoalOz)} label={` of  ounces`} color="var(--pine)">
              <Icon name="water" size={16} />
            </Ring>
          </div>
          <p className="pointer-events-none font-display text-[20px] font-bold leading-none">
            {waterOz}
            <span className="t-meta font-sans font-normal"> oz</span>
          </p>
          <p className="t-meta pointer-events-none">Tap +8 oz</p>
          <button
            type="button"
            className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full text-muted"
            onClick={() => setSheet("water")}
            aria-label="More water options"
          >
            <Icon name="more" size={18} />
          </button>
        </div>

        <button type="button" className="tile" onClick={() => setSheet("move")} aria-label={`Movement: ${minutes} minutes today. Open to log.`}>
          <span className="list-row-lead" style={{ width: 40, height: 40 }} aria-hidden="true">
            <Icon name="walk" size={18} />
          </span>
          <p className="font-display text-[20px] font-bold leading-none">
            {minutes}
            <span className="t-meta font-sans font-normal"> min</span>
          </p>
          <p className="t-meta">{kcal ? `~${kcal} kcal` : weeklyGoal ? `${weekMinutes}/${weeklyGoal} wk` : "Log activity"}</p>
        </button>

        <button type="button" className="tile" onClick={() => setSheet("weight")} aria-label={weighIn ? `Weight ${Number(weighIn.weight_lb)} pounds. Open to change.` : "Log weight"}>
          <span className="list-row-lead" style={{ width: 40, height: 40 }} aria-hidden="true">
            <Icon name="scale" size={18} />
          </span>
          <p className="font-display text-[20px] font-bold leading-none">
            {weighIn ? Number(weighIn.weight_lb) : "—"}
            {weighIn && <span className="t-meta font-sans font-normal"> lb</span>}
          </p>
          <p className="t-meta">{weighIn ? "Weighed" : "Log weight"}</p>
        </button>
      </div>

      <Sheet open={sheet === "water"} onClose={() => setSheet(null)} title="Water">
        <div className="in-sheet">
          <WaterCard logs={water} goalOz={waterGoalOz} onAdd={(oz) => onAddWater(oz).then(() => undefined)} onUndo={onUndoWater} />
        </div>
      </Sheet>
      <Sheet open={sheet === "move"} onClose={() => setSheet(null)} title="Movement">
        <div className="in-sheet">
          <MovementCard date={date} weekMovement={weekMovement} weeklyGoal={weeklyGoal} onAdd={onAddMovement} onRemove={onRemoveMovement} />
        </div>
      </Sheet>
      <Sheet open={sheet === "weight"} onClose={() => setSheet(null)} title="Weigh-in">
        <div className="in-sheet">
          <WeighInCard
            date={date}
            weighIn={weighIn}
            onSave={async (lb) => {
              await onSaveWeight(lb);
              setSheet(null);
              toast({ message: `Weight saved · ${lb} lb` });
            }}
            onRemove={onRemoveWeight}
          />
        </div>
      </Sheet>
    </>
  );
}
