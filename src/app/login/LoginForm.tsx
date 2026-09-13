"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/env";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "sending" });

    const redirectTo = new URL("/auth/callback", siteUrl());
    if (next) redirectTo.searchParams.set("next", next);

    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo.toString() },
    });

    if (error) setState({ kind: "error", message: error.message });
    else setState({ kind: "sent" });
  }

  if (state.kind === "sent") {
    return (
      <div className="card mt-8 p-5">
        <h2 className="font-display text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-[15px] text-muted">
          We sent a sign-in link to <span className="text-ink">{email}</span>. It opens Icebox
          directly — no password to remember.
        </p>
        <button type="button" className="btn btn-quiet mt-4" onClick={() => setState({ kind: "idle" })}>
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card mt-8 p-5">
      <label htmlFor="email" className="block text-[13px] font-semibold text-muted">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        inputMode="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="field mt-2"
      />

      {state.kind === "error" && (
        <p role="alert" className="mt-3 text-[14px]" style={{ color: "var(--tomato)" }}>
          {state.message}
        </p>
      )}

      <button type="submit" className="btn btn-primary mt-4 w-full" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Sending link…" : "Send me a sign-in link"}
      </button>

      <p className="mt-3 text-[13px] text-muted">
        No password, no tracking. Your data lives in your own Supabase project.
      </p>
    </form>
  );
}
