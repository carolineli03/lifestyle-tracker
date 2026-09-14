import { describe, expect, it } from "vitest";
import { bestStreak, currentStreak, weeklyReport } from "../src/lib/report.js";

describe("currentStreak", () => {
  it("counts back from today", () => {
    expect(currentStreak(["2026-09-12", "2026-09-13", "2026-09-14"], "2026-09-14")).toBe(3);
  });

  it("isn't broken yet when today has nothing logged so far", () => {
    expect(currentStreak(["2026-09-12", "2026-09-13"], "2026-09-14")).toBe(2);
  });

  it("is zero after a missed day", () => {
    expect(currentStreak(["2026-09-11", "2026-09-12"], "2026-09-14")).toBe(0);
  });

  it("crosses a month end", () => {
    expect(currentStreak(["2026-08-31", "2026-09-01"], "2026-09-01")).toBe(2);
  });

  it("ignores duplicate days", () => {
    expect(currentStreak(["2026-09-14", "2026-09-14"], "2026-09-14")).toBe(1);
  });
});

describe("bestStreak", () => {
  it("finds the longest run anywhere", () => {
    expect(bestStreak(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-07", "2026-09-08"])).toBe(3);
    expect(bestStreak([])).toBe(0);
  });
});

describe("weeklyReport", () => {
  const today = "2026-09-14";
  const report = weeklyReport({
    today,
    entries: [
      { logged_on: "2026-09-14", kcal: 1500, protein_g: 120 },
      { logged_on: "2026-09-13", kcal: 1000, protein_g: 60 },
      { logged_on: "2026-09-13", kcal: 700, protein_g: 40 },
      { logged_on: "2026-09-10", kcal: "2100", protein_g: "90" },
      { logged_on: "2026-09-07", kcal: 5000, protein_g: 500 }, // eight days back: outside the week
    ],
    weighIns: [
      { logged_on: "2026-09-08", weight_lb: 170.2 },
      { logged_on: "2026-09-14", weight_lb: "168.4" },
      { logged_on: "2026-09-01", weight_lb: 175 },
    ],
    movement: [
      { logged_on: "2026-09-13", minutes: 30, kcal: 134 },
      { logged_on: "2026-09-12", minutes: 45, kcal: null },
    ],
    water: [
      { logged_on: "2026-09-14", amount_oz: 16 },
      { logged_on: "2026-09-14", amount_oz: 8 },
      { logged_on: "2026-09-13", amount_oz: 64 },
    ],
    kcalTarget: 1600,
    proteinTarget: 130,
  });

  it("covers the seven days ending today", () => {
    expect([report.from, report.to]).toEqual(["2026-09-08", "2026-09-14"]);
  });

  it("averages only days that had food logged", () => {
    expect(report.daysLogged).toBe(3);
    expect(report.avgKcal).toBe(1767); // (1500 + 1700 + 2100) / 3
    expect(report.avgProtein).toBe(103); // (120 + 100 + 90) / 3
  });

  it("counts days within 10% under or 5% over the target", () => {
    // 1500 (-6%) and 1700 (+6%): only 1500 is on target; 2100 is over.
    expect(report.daysOnTarget).toBe(1);
  });

  it("measures weight change from the first to the last weigh-in in the week", () => {
    expect(report.weightChange).toBe(-1.8);
  });

  it("totals movement, treating an unknown calorie figure as unknown", () => {
    expect(report.movementMinutes).toBe(75);
    expect(report.movementKcal).toBe(134);
  });

  it("averages water over days that had any", () => {
    expect(report.avgWaterOz).toBe(44); // (24 + 64) / 2
  });

  it("has nothing to say about weight with a single weigh-in", () => {
    const r = weeklyReport({ today, entries: [], weighIns: [{ logged_on: today, weight_lb: 160 }], movement: [], water: [], kcalTarget: null, proteinTarget: null });
    expect(r.weightChange).toBeNull();
    expect(r.avgKcal).toBeNull();
    expect(r.avgWaterOz).toBeNull();
  });
});
