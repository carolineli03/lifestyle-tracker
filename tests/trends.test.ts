import { describe, expect, it } from "vitest";
import { goalPaceWeight, lastSevenDays, weightStats } from "../src/lib/trends.js";

describe("goalPaceWeight", () => {
  // 1 Sep → 10 Dec is 100 days, and crosses the November DST change.
  const start = { date: "2026-09-01", weight: 200 };
  const goal = { date: "2026-12-10", weight: 180 };

  it("is a straight line between start and goal", () => {
    expect(goalPaceWeight(start, goal, "2026-09-01")).toBe(200);
    expect(goalPaceWeight(start, goal, "2026-10-21")).toBe(190);
    expect(goalPaceWeight(start, goal, "2026-12-10")).toBe(180);
  });

  it("holds at the ends instead of extrapolating", () => {
    expect(goalPaceWeight(start, goal, "2026-08-01")).toBe(200);
    expect(goalPaceWeight(start, goal, "2027-03-01")).toBe(180);
  });

  it("does not divide by zero when the dates coincide", () => {
    expect(goalPaceWeight(start, { ...goal, date: start.date }, "2026-09-01")).toBe(180);
  });
});

describe("weightStats", () => {
  it("has nothing to say without weigh-ins", () => {
    expect(weightStats([], 200, 180)).toEqual({ latest: null, change: null, toGo: null });
  });

  it("measures change from the saved start weight", () => {
    const s = weightStats(
      [
        { date: "2026-09-10", weight: 196.4 },
        { date: "2026-09-03", weight: 199.2 },
      ],
      200,
      180,
    );
    expect(s.latest).toEqual({ date: "2026-09-10", weight: 196.4 });
    expect(s.change).toBe(-3.6);
    expect(s.toGo).toBe(16.4);
  });

  it("falls back to the first weigh-in when no start weight is saved", () => {
    const s = weightStats([{ date: "2026-09-10", weight: 150 }], null, null);
    expect(s.change).toBe(0);
    expect(s.toGo).toBeNull();
  });

  it("handles a gain goal in the right direction", () => {
    const s = weightStats([{ date: "2026-09-10", weight: 132 }], 128, 140);
    expect(s.change).toBe(4);
    expect(s.toGo).toBe(8);
  });

  it("goes to zero or below once the goal is passed", () => {
    expect(weightStats([{ date: "2026-09-10", weight: 179 }], 200, 180).toGo).toBe(-1);
  });
});

describe("lastSevenDays", () => {
  it("returns seven local days ending today, oldest first, summed per day", () => {
    const rows = [
      { logged_on: "2026-09-02", minutes: 15 },
      { logged_on: "2026-09-02", minutes: 30 },
      { logged_on: "2026-08-28", minutes: 20 },
      { logged_on: "2026-08-27", minutes: 60 }, // eight days back: excluded
    ];
    const days = lastSevenDays(rows, "2026-09-03");
    expect(days.map((d) => d.date)).toEqual([
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
    expect(days.map((d) => d.minutes)).toEqual([20, 0, 0, 0, 0, 45, 0]);
  });
});
