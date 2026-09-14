"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/env";
import { ErrorNote } from "@/components/ErrorNote";

/**
 * Guests (no email) get a way to keep their data instead of a sign-out button:
 * signing a guest out would leave their log unreachable forever. Adding an
 * email converts the same account in place — same user id, same rows — once
 * the confirmation link is clicked.
 */
export function AccountCard({ isGuest, email }: { isGuest: boolean; email: string | null }) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!isGuest) {
    return (
      <section className="mt-4">
        {email && <p className="mb-2 text-center text-[13px] text-muted">Signed in as {email}</p>}
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-quiet w-full">
            Sign out
          </button>
        </form>
      </section>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setState("sending");
    setError(null);
    const redirect = new URL("/auth/callback", siteUrl());
    redirect.searchParams.set("next", "/settings");
    const { error: updateError } = await supabaseBrowser().auth.updateUser(
      { email: value.trim() },
      { emailRedirectTo: redirect.toString() },
    );
    if (updateError) {
      setError(updateError.message);
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <section className="card mt-4 p-5" aria-labelledby="account-heading">
      <h2 id="account-heading" className="font-display text-lg font-semibold">
        Guest account on this device
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        No sign-in needed. Clearing this browser&rsquo;s data or switching phones starts a fresh account — add an
        email to keep your log and use it anywhere.
      </p>

      {state === "sent" ? (
        <p className="mt-3 text-[14px]" role="status">
          Check <span className="font-semibold">{value.trim()}</span> for a confirmation link. Your data stays exactly
          where it is.
        </p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-3 flex gap-2">
          <label htmlFor="keep-email" className="sr-only">
            Email address
          </label>
          <input
            id="keep-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className="field flex-1"
            placeholder="you@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="btn btn-quiet" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Keep my data"}
          </button>
        </form>
      )}

      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}
    </section>
  );
}
