import { describe, expect, it } from "vitest";
import {
  leftoverCandidates,
  portionsToMake,
  rowsForDay,
  scaleNote,
  weekDays,
  weekSummary,
  type PlanRow,
} from "../src/lib/planner.js";

// Sunday 13 Sep 2026 → the Monday-start week is 7–13 Sep; the next is 14–20.
const row = (over: Partial<PlanRow> & Pick<PlanRow, "id" | "planned_on" | "meal">): PlanRow => ({
  recipe_id: "chili",
  eaters: 2,
  leftovers_from: null,
  ...over,
});

const sundayDinner = row({ id: "cook", planned_on: "2026-09-13", meal: "dinner" });
const monLunch = row({ id: "l1", planned_on: "2026-09-14", meal: "lunch", leftovers_from: "cook" });
const tueLunch = row({ id: "l2", planned_on: "2026-09-15", meal: "lunch", leftovers_from: "cook", eaters: 1 });

describe("portionsToMake", () => {
  it("is the people at the cooked meal when there are no leftovers", () => {
    expect(portionsToMake(sundayDinner, [sundayDinner])).toBe(2);
  });

  it("adds the people at every meal eating the leftovers", () => {
    expect(portionsToMake(sundayDinner, [sundayDinner, monLunch, tueLunch])).toBe(5);
  });

  it("ignores leftovers that belong to a different cook", () => {
    const other = row({ id: "l3", planned_on: "2026-09-14", meal: "dinner", leftovers_from: "someone-else" });
    expect(portionsToMake(sundayDinner, [sundayDinner, other])).toBe(2);
  });
});

describe("scaleNote", () => {
  it("names the common cases plainly", () => {
    expect(scaleNote(4, 4)).toBe("the recipe as written");
    expect(scaleNote(3, 6)).toBe("half the recipe");
    expect(scaleNote(8, 4)).toBe("double the recipe");
  });

  it("gives a multiplier otherwise", () => {
    expect(scaleNote(6, 4)).toBe("1.5× the recipe");
    expect(scaleNote(5, 3)).toBe("1.67× the recipe");
  });

  it("says nothing for a recipe with no serving count", () => {
    expect(scaleNote(4, 0)).toBe("");
  });
});

describe("leftoverCandidates", () => {
  it("offers later meals the same day, then the next four days, in order", () => {
    const slots = leftoverCandidates(sundayDinner, [sundayDinner]);
    // Same day: only the snack comes after dinner. Then 4 full days × 4 meals.
    expect(slots[0]).toEqual({ planned_on: "2026-09-13", meal: "snack" });
    expect(slots[1]).toEqual({ planned_on: "2026-09-14", meal: "breakfast" });
    expect(slots).toHaveLength(1 + 4 * 4);
    expect(slots.at(-1)).toEqual({ planned_on: "2026-09-17", meal: "snack" });
  });

  it("never offers anything past the four-day fridge limit", () => {
    const slots = leftoverCandidates(sundayDinner, [sundayDinner]);
    expect(slots.some((s) => s.planned_on === "2026-09-18")).toBe(false);
  });

  it("skips slots that are already planned", () => {
    const slots = leftoverCandidates(sundayDinner, [sundayDinner, monLunch]);
    expect(slots).not.toContainEqual({ planned_on: "2026-09-14", meal: "lunch" });
  });

  it("never offers an earlier meal on the cooking day", () => {
    const lunchCook = row({ id: "c2", planned_on: "2026-09-14", meal: "lunch" });
    const sameDay = leftoverCandidates(lunchCook, [lunchCook]).filter((s) => s.planned_on === "2026-09-14");
    expect(sameDay.map((s) => s.meal)).toEqual(["dinner", "snack"]);
  });
});

describe("weekDays", () => {
  it("starts on Monday, even from a Sunday", () => {
    expect(weekDays("2026-09-13")).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });

  it("crosses a month end", () => {
    expect(weekDays("2026-10-01")[0]).toBe("2026-09-28");
    expect(weekDays("2026-10-01")[6]).toBe("2026-10-04");
  });
});

describe("weekSummary", () => {
  const week = weekDays("2026-09-14"); // 14–20 Sep

  it("counts cook days, portions and leftover meals inside the week", () => {
    const wedCook = row({ id: "w", planned_on: "2026-09-16", meal: "dinner", eaters: 2 });
    const thuLunch = row({ id: "wl", planned_on: "2026-09-17", meal: "lunch", leftovers_from: "w", eaters: 2 });
    const friCook = row({ id: "f", planned_on: "2026-09-18", meal: "dinner", eaters: 3 });
    expect(weekSummary([wedCook, thuLunch, friCook], week)).toEqual({ cookingDays: 2, portions: 7, leftoverMeals: 1 });
  });

  it("counts leftovers this week that came from last Sunday's cook, without counting that cook", () => {
    expect(weekSummary([sundayDinner, monLunch, tueLunch], week)).toEqual({
      cookingDays: 0,
      portions: 0,
      leftoverMeals: 2,
    });
  });
});

describe("rowsForDay", () => {
  it("puts a day's meals in breakfast → snack order", () => {
    const dinner = row({ id: "d", planned_on: "2026-09-14", meal: "dinner" });
    const breakfast = row({ id: "b", planned_on: "2026-09-14", meal: "breakfast" });
    expect(rowsForDay([dinner, monLunch, breakfast], "2026-09-14").map((r) => r.meal)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
    ]);
  });
});
