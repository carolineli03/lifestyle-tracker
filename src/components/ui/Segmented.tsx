"use client";

import { useRef } from "react";

export type SegmentOption<T extends string> = { value: T; label: React.ReactNode; badge?: number };

/** A pill segmented control with arrow-key navigation, like a native tab bar. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (next: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKey(e: React.KeyboardEvent, index: number): void {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={`segmented ${size === "sm" ? "segmented-sm" : ""}`}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-active={active}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
            {o.badge !== undefined && o.badge > 0 && <span className="segmented-badge">{o.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
