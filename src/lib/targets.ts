import type { SexAtBirth } from "@/lib/supabase/database.types";

/**
 * Target calculator maths for the Progress tab.
 *
 * Pure functions only, because this is one of the two places in the app where
 * a bug does real damage: a wrong number here gets saved as a daily target and
 * then quietly steers every meal.
 *
 *   BMR   Mifflin-St Jeor
 *   TDEE  BMR × activity factor
 *   kcal  TDEE − 500 per lb/week of target rate, floored at max(1,200, BMR)
 */

export const KCAL_FLOOR = 1200;
/** ~3,500 kcal per pound, spread over seven days. */
export const KCAL_PER_LB_PER_WEEK = 500;

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const ACTIVITY_LEVELS: ReadonlyArray<{ factor: number; label: string; hint: string }> = [
  { factor: 1.2, label: "Sedentary", hint: "Desk day, little walking" },
  { factor: 1.375, label: "Light", hint: "Exercise 1–3 days a week" },
  { factor: 1.55, label: "Moderate", hint: "Exercise 3–5 days a week" },
  { factor: 1.725, label: "Very active", hint: "Hard exercise 6–7 days a week" },
];

export const RATE_OPTIONS: readonly number[] = [0.5, 1, 1.5];

export type BodyInputs = {
  sex: SexAtBirth;
  age: number;
  heightIn: number;
  weightLb: number;
};

export type TargetInputs = BodyInputs & {
  activity: number;
  rateLbWeek: number;
};

export type TargetResult = {
  bmr: number;
  tdee: number;
  /** What the requested rate asks for before the floor is applied. */
  requestedKcal: number;
  floor: number;
  kcal: number;
  /** True when the floor overrode the requested rate. */
  clamped: boolean;
  /** The weekly loss the saved number actually produces. ≤ 0 means no loss. */
  actualRateLbWeek: number;
  protein: number;
  fat: number;
  carbs: number;
  /** True when protein hit the 40%-of-calories cap rather than 0.8 g/lb. */
  proteinCapped: boolean;
};

/** Basal metabolic rate by Mifflin-St Jeor, in kcal/day, unrounded. */
export function bmr({ sex, age, heightIn, weightLb }: BodyInputs): number {
  const kg = weightLb * KG_PER_LB;
  const cm = heightIn * CM_PER_IN;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function computeTargets(input: TargetInputs): TargetResult {
  const basal = bmr(input);
  const tdee = basal * input.activity;
  const requested = tdee - KCAL_PER_LB_PER_WEEK * input.rateLbWeek;
  const floor = Math.max(KCAL_FLOOR, basal);

  const clamped = requested < floor;
  const kcal = Math.round(clamped ? floor : requested);

  // Work the rate back from the rounded number that will actually be saved,
  // so the sentence in the UI matches the target rather than the intention.
  const actualRateLbWeek = round2((tdee - kcal) / KCAL_PER_LB_PER_WEEK);

  const proteinByWeight = 0.8 * input.weightLb;
  const proteinByShare = (0.4 * kcal) / 4;
  const proteinCapped = proteinByShare < proteinByWeight;
  const protein = Math.round(Math.min(proteinByWeight, proteinByShare));
  const fat = Math.round((0.27 * kcal) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return {
    bmr: Math.round(basal),
    tdee: Math.round(tdee),
    requestedKcal: Math.round(requested),
    floor: Math.round(floor),
    kcal,
    clamped,
    actualRateLbWeek,
    protein,
    fat,
    carbs,
    proteinCapped,
  };
}

/** Feet + inches → total inches. Blank inches count as zero. */
export function toInches(feet: number, inches: number): number {
  return feet * 12 + (Number.isFinite(inches) ? inches : 0);
}

/** Total inches → { feet, inches }, for prefilling the form from a profile. */
export function fromInches(total: number): { feet: number; inches: number } {
  const feet = Math.floor(total / 12);
  return { feet, inches: round2(total - feet * 12) };
}

export function isBelowFloor(kcal: number | null): boolean {
  return kcal !== null && kcal > 0 && kcal < KCAL_FLOOR;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
