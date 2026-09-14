"use client";

import { useEffect, useRef, useState } from "react";
import { postAi } from "@/lib/ai/client";
import { PhotoResponse } from "@/lib/ai/schemas";
import { prepareImage } from "@/lib/image";
import { round1 } from "@/lib/totals";
import type { Draft } from "./DraftTable";

export type NewDraft = Omit<Draft, "key">;

/**
 * Photo a nutrition label (or a plate) → editable draft rows with per-serving
 * numbers. You set how many servings you had in the draft before confirming.
 */
export function PhotoLog({
  onDrafts,
  onError,
}: {
  onDrafts: (drafts: NewDraft[]) => void;
  onError: (message: string | null) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Object URLs hold the whole image in memory until revoked.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function handle(file: File | undefined): Promise<void> {
    if (!file) return;
    onError(null);
    setStatus(null);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const image = await prepareImage(file);
      const result = await postAi("/api/photo", { image: image.base64, mediaType: image.mediaType }, PhotoResponse);
      if (result.items.length === 0) {
        onError("Couldn't find a nutrition label or any food in that photo. Try again closer up, or type it in.");
        return;
      }
      const fromLabel = result.source === "label";
      onDrafts(
        result.items.map((item) => ({
          name: item.name,
          base: { kcal: Math.round(item.kcal), protein_g: round1(item.protein), carb_g: round1(item.carbs), fat_g: round1(item.fat) },
          nutrients: { fiber_g: item.fiber_g, sugar_g: item.sugar_g, sodium_mg: item.sodium_mg },
          servingLabel: fromLabel ? item.serving_size : null,
          servings: 1,
          remember: fromLabel,
          note: fromLabel
            ? `From the label · 1 serving = ${item.serving_size ?? "as printed"}. Set how many you had.`
            : `Estimated from the photo${item.serving_size ? ` · ${item.serving_size}` : ""}. Check the numbers.`,
        })),
      );
      setStatus(
        fromLabel
          ? "Label read. Set your servings below, then add it to the log."
          : `${result.items.length} ${result.items.length === 1 ? "item" : "items"} estimated. Check them below.`,
      );
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "That photo didn't work. You can still type it in.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    }
  }

  return (
    <div className="mt-4">
      <p className="text-[14px] text-muted">
        Snap the Nutrition Facts label — or the plate, if there isn&rsquo;t one. The photo isn&rsquo;t saved.
      </p>

      {/* capture="environment" opens the rear camera on phones; desktop browsers ignore it. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void handle(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void handle(e.target.files?.[0])}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => cameraRef.current?.click()}>
          Take photo
        </button>
        <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => libraryRef.current?.click()}>
          Choose photo
        </button>
      </div>

      {preview && (
        <div className="mt-3 flex items-center gap-3">
          {/* A local object URL: next/image has nothing to optimise here. */}
          <img
            src={preview}
            alt="The photo being read"
            className="rounded-field object-cover"
            style={{ width: 64, height: 64, border: "1px solid var(--line)" }}
          />
          <p className="text-[14px]" aria-live="polite">
            {busy ? "Reading the photo…" : status}
          </p>
        </div>
      )}
    </div>
  );
}
