"use client";

import { useEffect, useState } from "react";
import { DbSearchResponse, type DbFood } from "@/lib/fooddb";

/**
 * "From the food database" under your own foods. Waits for a pause in typing
 * so every keystroke isn't a round trip to two outside services.
 */
export function FoodDbResults({ query, onPick }: { query: string; onPick: (food: DbFood) => void }) {
  const [foods, setFoods] = useState<DbFood[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setFoods([]);
      setState("idle");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState("loading");
      fetch(`/api/foods/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (res) => {
          const body: unknown = await res.json();
          if (!res.ok) throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
          const parsed = DbSearchResponse.safeParse(body);
          if (!parsed.success) throw new Error("The food database sent back something unexpected.");
          setFoods(parsed.data.foods);
          setPartial(parsed.data.partial);
          setState("done");
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setMessage(cause instanceof Error ? cause.message : "Search failed.");
          setState("error");
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  if (state === "idle") return null;

  return (
    <div className="mt-3" aria-live="polite">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">From the food database</p>
      {state === "loading" && <p className="mt-2 text-[14px] text-muted">Searching…</p>}
      {state === "error" && (
        <p className="mt-2 text-[14px]" style={{ color: "var(--tomato)" }}>
          {message}
        </p>
      )}
      {state === "done" && foods.length === 0 && <p className="mt-2 text-[14px] text-muted">No matches.</p>}
      {state === "done" && foods.length > 0 && (
        <ul className="mt-2 grid grid-cols-1 gap-1">
          {foods.map((food) => (
            <li key={`${food.source}-${food.id}`}>
              <button
                type="button"
                onClick={() => onPick(food)}
                className="flex w-full items-center justify-between gap-3 rounded-field px-3 py-2 text-left"
                style={{ border: "1px solid var(--line)", background: "var(--card)" }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{food.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {[food.brand, food.servingLabel, food.sourceLabel].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-muted">
                  {food.macros.kcal} kcal · {Math.round(food.macros.protein_g)}p
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {partial && state === "done" && (
        <p className="mt-1 text-[12px] text-muted">One of the two databases didn&rsquo;t answer; showing what came back.</p>
      )}
    </div>
  );
}
