"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production builds only. In `next dev` a caching worker
 * would serve stale bundles over hot reloads and make every change look broken.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((cause: unknown) => {
      console.warn("[sw] registration failed", cause);
    });
  }, []);
  return null;
}
