import { describe, expect, it } from "vitest";
import {
  bmr,
  computeTargets,
  fromInches,
  isBelowFloor,
  KCAL_FLOOR,
  toInches,
} from "../src/lib/targets.js";

// Expected values below were worked by hand from the published formula
// (10·kg + 6.25·cm − 5·age, +5 male / −161 female), not copied from the code.

describe("bmr (Mifflin-St Jeor)", () => {
  it("matches a hand-worked female example", () => {
    // 180 lb = 81.6466 kg, 65 in = 165.1 cm, age 35
    expect(bmr({ sex: "female", age: 35, heightIn: 65, weightLb: 180 })).toBeCloseTo(1512.34, 1);
  });

  it("matches a hand-worked male example", () => {
    // 200 lb = 90.7185 kg, 70 in = 177.8 cm, age 40
    expect(bmr({ sex: "male", age: 40, heightIn: 70, weightLb: 200 })).toBeCloseTo(1823.43, 1);
  });

  it("differs by exactly 166 kcal between sexes for the same body", () => {
    const body = { age: 30, heightIn: 66, weightLb: 150 };
    expect(bmr({ ...body, sex: "male" }) - bmr({ ...body, sex: "female" })).toBeCloseTo(166, 6);
  });
});

describe("computeTargets", () => {
  it("applies activity and a 500 kcal/day deficit per lb/week when above the floor", () => {
    const r = computeTargets({
      sex: "female",
      age: 35,
      heightIn: 65,
      weightLb: 180,
      activity: 1.375,
      rateLbWeek: 1,
    });
    expect(r.bmr).toBe(1512);
    expect(r.tdee).toBe(2079);
    expect(r.requestedKcal).toBe(1579);
    expect(r.clamped).toBe(false);
    expect(r.kcal).toBe(1579);
    expect(r.actualRateLbWeek).toBe(1);
  });

  it("splits macros: protein 0.8 g/lb, fat 27%, carbs the remainder", () => {
    const r = computeTargets({
      sex: "female",
      age: 35,
      heightIn: 65,
      weightLb: 180,
      activity: 1.375,
      rateLbWeek: 1,
    });
    expect(r.protein).toBe(144); // 0.8 × 180, under the 40% cap of 157.9 g
    expect(r.proteinCapped).toBe(false);
    expect(r.fat).toBe(47); // 0.27 × 1579 / 9 = 47.37
    expect(r.carbs).toBe(145); // (1579 − 576 − 423) / 4
    expect(r.protein * 4 + r.carbs * 4 + r.fat * 9).toBe(1579);
  });

  it("clamps to BMR when BMR is above 1,200 and reports the real rate", () => {
    // BMR 1430.75, TDEE 1716.90; 1.5 lb/wk would ask for 966.90.
    const r = computeTargets({
      sex: "female",
      age: 30,
      heightIn: 64,
      weightLb: 160,
      activity: 1.2,
      rateLbWeek: 1.5,
    });
    expect(r.requestedKcal).toBe(967);
    expect(r.clamped).toBe(true);
    expect(r.floor).toBe(1431);
    expect(r.kcal).toBe(1431);
    expect(r.actualRateLbWeek).toBe(0.57); // (1716.90 − 1431) / 500
  });

  it("clamps to 1,200 when BMR is below it", () => {
    // BMR 990.45, TDEE 1361.87; 1 lb/wk would ask for 861.87.
    const r = computeTargets({
      sex: "female",
      age: 60,
      heightIn: 60,
      weightLb: 110,
      activity: 1.375,
      rateLbWeek: 1,
    });
    expect(r.bmr).toBe(990);
    expect(r.floor).toBe(KCAL_FLOOR);
    expect(r.clamped).toBe(true);
    expect(r.kcal).toBe(1200);
    expect(r.actualRateLbWeek).toBe(0.32);
  });

  it("reports a non-positive rate when TDEE itself is under the floor", () => {
    // BMR 863.34, TDEE 1036.01 — even eating 1,200 is above maintenance.
    const r = computeTargets({
      sex: "female",
      age: 70,
      heightIn: 58,
      weightLb: 100,
      activity: 1.2,
      rateLbWeek: 0.5,
    });
    expect(r.kcal).toBe(1200);
    expect(r.clamped).toBe(true);
    expect(r.actualRateLbWeek).toBeLessThanOrEqual(0);
    expect(r.actualRateLbWeek).toBe(-0.33);
  });

  it("never returns a target below 1,200 or below BMR", () => {
    for (const weightLb of [95, 130, 180, 260]) {
      for (const activity of [1.2, 1.375, 1.55, 1.725]) {
        for (const rateLbWeek of [0.5, 1, 1.5]) {
          for (const sex of ["female", "male"] as const) {
            const r = computeTargets({ sex, age: 45, heightIn: 64, weightLb, activity, rateLbWeek });
            expect(r.kcal).toBeGreaterThanOrEqual(KCAL_FLOOR);
            expect(r.kcal).toBeGreaterThanOrEqual(Math.floor(r.bmr));
          }
        }
      }
    }
  });

  it("caps protein at 40% of calories for a heavier body on a low target", () => {
    // BMR 1657.23 is the floor; 0.8 × 250 = 200 g would be 48% of 1,657 kcal.
    const r = computeTargets({
      sex: "female",
      age: 60,
      heightIn: 62,
      weightLb: 250,
      activity: 1.2,
      rateLbWeek: 1.5,
    });
    expect(r.kcal).toBe(1657);
    expect(r.proteinCapped).toBe(true);
    expect(r.protein).toBe(166); // 0.40 × 1657 / 4 = 165.7
  });

  it("keeps macro calories within rounding of the target", () => {
    for (const weightLb of [120, 175, 240]) {
      const r = computeTargets({
        sex: "male",
        age: 33,
        heightIn: 71,
        weightLb,
        activity: 1.55,
        rateLbWeek: 1,
      });
      const fromMacros = r.protein * 4 + r.carbs * 4 + r.fat * 9;
      expect(Math.abs(fromMacros - r.kcal)).toBeLessThanOrEqual(7);
    }
  });
});

describe("height helpers", () => {
  it("round-trips feet and inches", () => {
    expect(toInches(5, 7)).toBe(67);
    expect(fromInches(67)).toEqual({ feet: 5, inches: 7 });
    expect(fromInches(69.5)).toEqual({ feet: 5, inches: 9.5 });
  });

  it("treats blank inches as zero", () => {
    expect(toInches(6, Number.NaN)).toBe(72);
  });
});

describe("isBelowFloor", () => {
  it("warns under 1,200 only", () => {
    expect(isBelowFloor(1199)).toBe(true);
    expect(isBelowFloor(1200)).toBe(false);
    expect(isBelowFloor(null)).toBe(false);
  });
});
