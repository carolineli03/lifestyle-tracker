import { describe, expect, it } from "vitest";
import { copyMeal, defaultMeal, groupByMeal } from "../src/lib/meals.js";
import { scaleNutrients, sumNutrients } from "../src/lib/nutrients.js";
import { adjustedTarget, caloriesBurned, metFor } from "../src/lib/exercise.js";

const at = (h: number, m: number) => new Date(2026, 8, 14, h, m);

describe("defaultMeal", () => {
  it("follows the local clock", () => {
    expect(defaultMeal(at(7, 0))).toBe("breakfast");
    expect(defaultMeal(at(10, 29))).toBe("breakfast");
    expect(defaultMeal(at(10, 30))).toBe("lunch");
    expect(defaultMeal(at(14, 59))).toBe("lunch");
    expect(defaultMeal(at(15, 0))).toBe("dinner");
    expect(defaultMeal(at(21, 0))).toBe("snack");
    expect(defaultMeal(at(2, 0))).toBe("breakfast");
  });
});

describe("groupByMeal", () => {
  const entries = [
    { id: "a", meal: "breakfast" as const, kcal: 300 },
    { id: "b", meal: "dinner" as const, kcal: 650 },
    { id: "c", meal: "breakfast" as const, kcal: 120.4 },
  ];

  it("keeps meal order, sums each section and keeps empty meals", () => {
    const s = groupByMeal(entries);
    expect(s.map((x) => [x.key, x.entries.length, x.kcal])).toEqual([
      ["breakfast", 2, 420],
      ["lunch", 0, 0],
      ["dinner", 1, 650],
      ["snack", 0, 0],
    ]);
  });

  it("adds Other only when older entries have no meal", () => {
    const s = groupByMeal([...entries, { id: "d", meal: null, kcal: 90 }]);
    expect(s.at(-1)).toMatchObject({ key: "other", kcal: 90 });
  });
});

describe("copyMeal", () => {
  const yesterday = [
    { name: "Oats", kcal: 300, protein_g: 10, carb_g: 50, fat_g: 6, fiber_g: 8, sugar_g: null, sodium_mg: 0, food_id: "f1", meal: "breakfast" as const },
    { name: "Coffee", kcal: 5, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: null, sugar_g: null, sodium_mg: null, food_id: null, meal: "breakfast" as const },
    { name: "Chili", kcal: 500, protein_g: 40, carb_g: 30, fat_g: 20, fiber_g: 10, sugar_g: 6, sodium_mg: 900, food_id: "f2", meal: "dinner" as const },
  ];

  it("copies only the chosen meal, re-dated, keeping the food link and unknown nutrients as null", () => {
    const rows = copyMeal(yesterday, "breakfast", "2026-09-14", "breakfast", "u1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      user_id: "u1", logged_on: "2026-09-14", meal: "breakfast", name: "Oats",
      kcal: 300, protein_g: 10, carb_g: 50, fat_g: 6, fiber_g: 8, sugar_g: null, sodium_mg: 0, food_id: "f1",
    });
    expect(rows[1]?.sodium_mg).toBeNull();
  });

  it("can move a meal into a different slot", () => {
    expect(copyMeal(yesterday, "dinner", "2026-09-14", "lunch", "u1")[0]?.meal).toBe("lunch");
  });
});

describe("nutrients", () => {
  it("scales known values and leaves unknown ones unknown", () => {
    expect(scaleNutrients({ fiber_g: 3, sugar_g: null, sodium_mg: 125 }, 1.5)).toEqual({ fiber_g: 4.5, sugar_g: null, sodium_mg: 188 });
  });

  it("counts how many entries were missing a figure instead of treating them as zero", () => {
    const t = sumNutrients([
      { fiber_g: 8, sugar_g: null, sodium_mg: "120" },
      { fiber_g: null, sugar_g: 12.25, sodium_mg: 340 },
    ]);
    expect(t.fiber_g).toEqual({ amount: 8, known: 1, missing: 1 });
    expect(t.sugar_g).toEqual({ amount: 12.3, known: 1, missing: 1 });
    expect(t.sodium_mg).toEqual({ amount: 460, known: 2, missing: 0 });
  });
});

describe("exercise", () => {
  it("matches activities by keyword, specific before general", () => {
    expect(metFor("Walk")).toBe(3.5);
    expect(metFor("Morning run")).toBe(9.8);
    expect(metFor("Spin class")).toBe(7.5);
    expect(metFor("Strength")).toBe(5);
    expect(metFor("Yoga")).toBe(2.5);
    expect(metFor("Gardening")).toBe(4);
  });

  it("works out calories from weight and time", () => {
    // 3.5 × 168.4 lb (76.38 kg) × 0.5 h = 133.7
    expect(caloriesBurned("Walk", 30, 168.4)).toBe(134);
  });

  it("refuses to guess without a weight", () => {
    expect(caloriesBurned("Walk", 30, null)).toBeNull();
  });

  it("adds exercise to the target only when the setting is on", () => {
    expect(adjustedTarget(1500, 134, true)).toBe(1634);
    expect(adjustedTarget(1500, 134, false)).toBe(1500);
    expect(adjustedTarget(null, 134, true)).toBeNull();
  });
});
