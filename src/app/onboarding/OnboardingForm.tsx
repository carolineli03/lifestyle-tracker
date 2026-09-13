"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "create" | "join";

export function OnboardingForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("Our kitchen");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: rpcError } =
      mode === "create"
        ? await supabase.rpc("create_household", { p_name: name.trim() })
        : await supabase.rpc("join_household", { p_code: code.trim() });

    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }

    router.replace("/today");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mt-8 p-5">
      <div role="radiogroup" aria-label="Setup choice" className="flex gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "create"}
          data-active={mode === "create"}
          className="chip"
          onClick={() => setMode("create")}
        >
          Start a kitchen
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "join"}
          data-active={mode === "join"}
          className="chip"
          onClick={() => setMode("join")}
        >
          Join with a code
        </button>
      </div>

      {mode === "create" ? (
        <div className="mt-5">
          <label htmlFor="household-name" className="block text-[13px] font-semibold text-muted">
            Name this kitchen
          </label>
          <input
            id="household-name"
            className="field mt-2"
            value={name}
            maxLength={80}
            required
            onChange={(e) => setName(e.target.value)}
          />
          <p className="mt-2 text-[13px] text-muted">
            You&rsquo;ll get a six-character code to pass to whoever shares the fridge.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <label htmlFor="join-code" className="block text-[13px] font-semibold text-muted">
            Join code
          </label>
          <input
            id="join-code"
            className="field mt-2 font-display text-xl tracking-[0.25em] uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            minLength={6}
            required
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC234"
          />
          <p className="mt-2 text-[13px] text-muted">
            Ask the person who set up the kitchen — it&rsquo;s on their Fridge tab.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-[14px]" style={{ color: "var(--tomato)" }}>
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary mt-5 w-full" disabled={busy}>
        {busy ? "Setting up…" : mode === "create" ? "Create kitchen" : "Join kitchen"}
      </button>
    </form>
  );
}
