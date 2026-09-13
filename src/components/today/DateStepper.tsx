"use client";

import { addDays, describeDate, isFuture, todayIso, type IsoDate } from "@/lib/date";

/**
 * Forward is disabled at today. There is no useful reading of "tomorrow's
 * calories remaining", and letting the date run ahead just creates entries
 * filed under a day that has not happened.
 */
export function DateStepper({
  date,
  onChange,
}: {
  date: IsoDate;
  onChange: (next: IsoDate) => void;
}) {
  const today = todayIso();
  const nextDay = addDays(date, 1);
  const canGoForward = !isFuture(nextDay, today);

  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onChange(addDays(date, -1))}
        className="btn btn-quiet"
        aria-label="Previous day"
        style={{ width: 44, padding: 0 }}
      >
        <Chevron direction="left" />
      </button>

      <div className="text-center">
        <p className="font-display text-[17px] font-semibold">{describeDate(date, today)}</p>
        {date !== today && (
          <button
            type="button"
            onClick={() => onChange(today)}
            className="text-[13px] font-semibold"
            style={{ color: "var(--pine)", minHeight: 0 }}
          >
            Back to today
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(nextDay)}
        className="btn btn-quiet"
        aria-label="Next day"
        disabled={!canGoForward}
        style={{ width: 44, padding: 0 }}
      >
        <Chevron direction="right" />
      </button>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}
