"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Tells you the numbers on screen may be the last ones loaded, not live ones. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-20 -mx-5 mb-3 px-5 py-2 text-center text-[13px] font-semibold"
      style={{ background: "var(--marigold-wash)", color: "var(--ink)", borderBottom: "1px solid var(--marigold)" }}
    >
      Offline — showing what was last loaded. Changes won&rsquo;t save until you&rsquo;re back online.
    </div>
  );
}
