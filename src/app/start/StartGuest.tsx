"use client";

import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * No sign-in step: the first visit creates an anonymous Supabase account and
 * carries on. Row Level Security still applies — a guest is a real user with
 * a real auth.uid(), just without an email yet.
 *
 * This runs in the browser on purpose. Crawlers and link previews that don't
 * execute JavaScript never reach signInAnonymously, so they don't leave a
 * trail of empty accounts behind.
 */
export function StartGuest() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Strict mode mounts effects twice in development; one account is enough.
    if (started.current) return;
    started.current = true;

    const next = params.get("next");
    const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/today";

    supabaseBrowser()
      .auth.signInAnonymously()
      .then(({ error: signInError }) => {
        if (signInError) {
          setError(signInError.message);
          return;
        }
        router.replace(destination as Route);
        router.refresh();
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Couldn't reach the server.");
      });
  }, [params, router]);

  if (!error) {
    return (
      <p className="mt-8 text-[15px] text-muted" aria-live="polite">
        Opening your kitchen…
      </p>
    );
  }

  return (
    <div className="card mt-8 p-5" role="alert">
      <h2 className="font-display text-lg font-semibold">Couldn&rsquo;t start a guest session</h2>
      <p className="mt-2 text-[15px] text-muted">{error}</p>
      <p className="mt-2 text-[14px] text-muted">
        If this says anonymous sign-ins are disabled, turn them on in Supabase under Authentication → Sign In /
        Providers.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link href="/login" className="btn btn-quiet">
          Sign in with email instead
        </Link>
      </div>
    </div>
  );
}
