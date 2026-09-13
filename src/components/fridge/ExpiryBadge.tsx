"use client";

import { expiryLabel, expiryTone, type ExpiryTone } from "@/lib/expiry";

const TONE_STYLE: Record<Exclude<ExpiryTone, "calm">, { color: string; background: string }> = {
  gone: { color: "var(--tomato)", background: "var(--tomato-wash)" },
  urgent: { color: "var(--tomato)", background: "var(--tomato-wash)" },
  soon: { color: "var(--marigold)", background: "var(--marigold-wash)" },
};

export function ExpiryBadge({ expiresOn }: { expiresOn: string | null }) {
  const label = expiryLabel(expiresOn);
  if (!label) return null;

  const tone = expiryTone(expiresOn);
  const style =
    tone === "calm"
      ? { color: "var(--muted)", background: "transparent" }
      : TONE_STYLE[tone];

  return (
    <span
      className="shrink-0 rounded-pill px-2 py-0.5 text-[12px] font-semibold"
      style={style}
      // Screen readers get the full sentence; sighted users get the badge.
      aria-label={tone === "gone" ? `Use-by was ${label}` : `Use by ${label}`}
    >
      {label}
    </span>
  );
}
