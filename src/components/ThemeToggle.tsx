"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "lifestyle-tracker-theme";

function apply(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/** Three-state override on top of `prefers-color-scheme`. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function choose(next: Theme): void {
    setTheme(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing. The choice still applies for this session.
    }
  }

  const options: ReadonlyArray<{ value: Theme; label: string }> = [
    { value: "system", label: "Auto" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex gap-1 rounded-pill border border-line bg-card p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => choose(o.value)}
          className={`rounded-pill px-3 text-[13px] font-semibold ${
            theme === o.value ? "bg-pine text-on-pine" : "text-muted"
          }`}
          style={{ minHeight: 32 }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
