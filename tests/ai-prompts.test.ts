import { describe, expect, it } from "vitest";
import {
  cookMessage,
  describeShelfLife,
  estimateMessage,
  formatBudget,
  formatPantry,
  prepMessage,
  type PantryLine,
} from "../src/lib/ai/prompts.js";

const today = "2026-09-13";

const pantry: PantryLine[] = [
  { name: "Rice", quantity: "2 lb", location: "pantry", expires_on: null },
  { name: "Spinach", quantity: null, location: "fridge", expires_on: "2026-09-14" },
  { name: "Old yogurt", quantity: "1 tub", location: "fridge", expires_on: "2026-09-11" },
  { name: "Chicken thighs", quantity: "1.5 lb", location: "fridge", expires_on: "2026-09-13" },
  { name: "Frozen peas", quantity: null, location: "freezer", expires_on: "2027-01-10" },
];

describe("describeShelfLife", () => {
  it("counts days in plain words", () => {
    expect(describeShelfLife("2026-09-14", today)).toBe("1 day left");
    expect(describeShelfLife("2026-09-18", today)).toBe("5 days left");
    expect(describeShelfLife("2026-09-13", today)).toBe("use today");
    expect(describeShelfLife("2026-09-12", today)).toBe("1 day past its date");
    expect(describeShelfLife("2026-09-10", today)).toBe("3 days past its date");
    expect(describeShelfLife(null, today)).toBe("no use-by date");
  });
});

describe("formatPantry", () => {
  it("lists the soonest use-by first and undated items last", () => {
    const lines = formatPantry(pantry, today).split("\n");
    expect(lines).toEqual([
      "- Old yogurt (1 tub) · fridge · 2 days past its date",
      "- Chicken thighs (1.5 lb) · fridge · use today",
      "- Spinach · fridge · 1 day left",
      "- Frozen peas · freezer · 119 days left",
      "- Rice (2 lb) · pantry · no use-by date",
    ]);
  });

  it("does not reorder the caller's array", () => {
    const copy = [...pantry];
    formatPantry(pantry, today);
    expect(pantry).toEqual(copy);
  });
});

describe("formatBudget", () => {
  it("gives calories and protein left", () => {
    expect(formatBudget({ kcalTarget: 1800, proteinTarget: 130, eatenKcal: 640.4, eatenProtein: 51 })).toBe(
      "Calories left today: 1160 kcal.\nProtein left today: 79 g.",
    );
  });

  it("says when the day is already over target instead of a negative budget", () => {
    expect(formatBudget({ kcalTarget: 1800, proteinTarget: 130, eatenKcal: 1900, eatenProtein: 140 })).toBe(
      "Already at or over today's calorie target (by 100 kcal) — keep it light.\nToday's protein target is already met.",
    );
  });

  it("says plainly when no target is set", () => {
    expect(formatBudget({ kcalTarget: null, proteinTarget: null, eatenKcal: 300, eatenProtein: 20 })).toBe(
      "No daily calorie target is set.",
    );
  });
});

describe("messages", () => {
  it("fences user-typed text as data", () => {
    expect(estimateMessage("2 eggs")).toBe("What I ate:\n<description>\n2 eggs\n</description>");
  });

  it("puts the meal, the budget and the kitchen in the cook prompt", () => {
    const msg = cookMessage(pantry, today, { kcalTarget: 1800, proteinTarget: null, eatenKcal: 800, eatenProtein: 0 }, "dinner");
    expect(msg.startsWith("Meal: dinner.\n\nCalories left today: 1000 kcal.")).toBe(true);
    expect(msg.indexOf("Old yogurt")).toBeLessThan(msg.indexOf("Rice"));
  });

  it("sizes prep lunches from the calorie target when there is one", () => {
    expect(prepMessage(pantry, today, 5, 2000)).toContain("roughly 700 kcal per assembled lunch");
    expect(prepMessage(pantry, today, 5, null)).toContain("No daily calorie target is set");
  });
});
