import { describe, expect, it } from "vitest";
import {
  caloriesRemaining,
  isOver,
  progressFraction,
  rankFoods,
  scalePortion,
  sumMacros,
} from "../src/lib/totals.js";

describe("sumMacros", () => {
  it("adds up a day of entries", () => {
    expect(
      sumMacros([
        { kcal: 220, protein_g: 14, carb_g: 2, fat_g: 16 },
        { kcal: 310, protein_g: 9, carb_g: 42, fat_g: 11 },
      ]),
    ).toEqual({ kcal: 530, protein_g: 23, carb_g: 44, fat_g: 27 });
  });

  it("treats an empty day as zero, not as missing", () => {
    expect(sumMacros([])).toEqual({ kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 });
  });

  it("tolerates rows with gaps", () => {
    expect(sumMacros([{ kcal: 100 }, { protein_g: 5 }])).toEqual({
      kcal: 100,
      protein_g: 5,
      carb_g: 0,
      fat_g: 0,
    });
  });
});

describe("caloriesRemaining", () => {
  it("counts down from the target", () => {
    expect(caloriesRemaining(530, 1850)).toBe(1320);
  });

  it("goes negative rather than hiding an overshoot", () => {
    expect(caloriesRemaining(2000, 1850)).toBe(-150);
  });

  it("has nothing to say without a target", () => {
    expect(caloriesRemaining(530, null)).toBeNull();
  });
});

describe("progressFraction", () => {
  it("is a plain ratio in range", () => {
    expect(progressFraction(925, 1850)).toBe(0.5);
  });

  it("clamps past the target so the bar cannot overflow its track", () => {
    expect(progressFraction(3000, 1850)).toBe(1);
  });

  it("is zero when there is no target to measure against", () => {
    expect(progressFraction(500, null)).toBe(0);
    expect(progressFraction(500, 0)).toBe(0);
  });
});

describe("isOver", () => {
  it("separates 'at target' from 'over target'", () => {
    expect(isOver(1850, 1850)).toBe(false);
    expect(isOver(1851, 1850)).toBe(true);
  });

  it("never flags an overshoot without a target", () => {
    expect(isOver(5000, null)).toBe(false);
  });
});

describe("scalePortion", () => {
  const base = { kcal: 130, protein_g: 22, carb_g: 8.4, fat_g: 0.6 };

  it("halves a portion and keeps the numbers readable", () => {
    expect(scalePortion(base, 0.5)).toEqual({
      kcal: 65,
      protein_g: 11,
      carb_g: 4.2,
      fat_g: 0.3,
    });
  });

  it("rounds away float noise", () => {
    expect(scalePortion({ kcal: 100, protein_g: 18.4, carb_g: 0, fat_g: 0 }, 3)).toEqual({
      kcal: 300,
      protein_g: 55.2,
      carb_g: 0,
      fat_g: 0,
    });
  });

  it("treats a nonsense portion as zero rather than NaN", () => {
    expect(scalePortion(base, Number.NaN)).toEqual({ kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 });
    expect(scalePortion(base, -2)).toEqual({ kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 });
  });
});

describe("rankFoods", () => {
  const foods = [
    { name: "Greek yogurt", times_logged: 12 },
    { name: "Yogurt drink", times_logged: 3 },
    { name: "Sourdough", times_logged: 20 },
    { name: "Eggs", times_logged: 40 },
  ];

  it("shows the most-logged foods before anything is typed", () => {
    expect(rankFoods(foods, "").map((f) => f.name)).toEqual([
      "Eggs",
      "Sourdough",
      "Greek yogurt",
      "Yogurt drink",
    ]);
  });

  it("puts a prefix match ahead of a mid-word one", () => {
    expect(rankFoods(foods, "yog").map((f) => f.name)).toEqual(["Yogurt drink", "Greek yogurt"]);
  });

  it("breaks ties on how often the food has been logged", () => {
    const tied = [
      { name: "Oat milk", times_logged: 2 },
      { name: "Oatmeal", times_logged: 9 },
    ];
    expect(rankFoods(tied, "oat").map((f) => f.name)).toEqual(["Oatmeal", "Oat milk"]);
  });

  it("is case-insensitive", () => {
    expect(rankFoods(foods, "GREEK").map((f) => f.name)).toEqual(["Greek yogurt"]);
  });

  it("returns nothing rather than everything when there is no match", () => {
    expect(rankFoods(foods, "quinoa")).toEqual([]);
  });
});
