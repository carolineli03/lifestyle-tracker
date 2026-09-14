import { z } from "zod";

/**
 * Turning outside food databases into one shape: macros and nutrients for ONE
 * serving, a label saying what that serving is, and where the numbers came from.
 *
 * Sources:
 *   - Open Food Facts: packaged foods, strong on barcodes. Free, no key.
 *     Nutrients are per 100 g and, when known, per serving. Sodium is in grams.
 *   - USDA FoodData Central: generic foods (SR Legacy, Foundation) and US
 *     branded products. Search results give nutrients per 100 g, plus a serving size.
 *
 * When there's no serving size, everything is per 100 g and `per100g` says so.
 * Missing nutrients stay null. Nothing is invented.
 */

export const DbFood = z.object({
  source: z.enum(["off", "usda"]),
  sourceLabel: z.string(),
  id: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  servingLabel: z.string(),
  per100g: z.boolean(),
  barcode: z.string().nullable(),
  macros: z.object({ kcal: z.number(), protein_g: z.number(), carb_g: z.number(), fat_g: z.number() }),
  nutrients: z.object({ fiber_g: z.number().nullable(), sugar_g: z.number().nullable(), sodium_mg: z.number().nullable() }),
});
export type DbFood = z.infer<typeof DbFood>;

export const DbSearchResponse = z.object({ foods: z.array(DbFood), partial: z.boolean() });
export const DbBarcodeResponse = z.object({ food: DbFood.nullable() });

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

function finite(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Title-case SHOUTED names from branded databases: "GREEK YOGURT PLAIN" → "Greek Yogurt Plain". */
export function tidyName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

// --- Open Food Facts ---------------------------------------------------------

export type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

export function normaliseOff(p: OffProduct): DbFood | null {
  const n = p.nutriments ?? {};
  const name = p.product_name?.trim();
  if (!name) return null;

  const hasServing = finite(n["energy-kcal_serving"]) !== null;
  const qty = finite(p.serving_quantity);
  // Prefer the label's own per-serving figures, then scale per-100 g by the
  // serving weight, then fall back to per 100 g.
  const mode: "serving" | "scaled" | "100g" = hasServing ? "serving" : qty ? "scaled" : "100g";
  const factor = mode === "scaled" && qty ? qty / 100 : 1;
  const pick = (key: string): number | null => {
    const v = mode === "serving" ? finite(n[`${key}_serving`]) : finite(n[`${key}_100g`]);
    return v === null ? null : v * factor;
  };

  const kcal = pick("energy-kcal");
  if (kcal === null) return null;
  const sodiumG = pick("sodium");
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(",")[0];

  return {
    source: "off",
    sourceLabel: "Open Food Facts",
    id: p.code ?? name,
    name: tidyName(name),
    brand: brand?.trim() || null,
    servingLabel: mode === "100g" ? "100 g" : p.serving_size?.trim() || `${qty} g`,
    per100g: mode === "100g",
    barcode: p.code && /^[0-9]{6,14}$/.test(p.code) ? p.code : null,
    macros: {
      kcal: r0(kcal),
      protein_g: r1(pick("proteins") ?? 0),
      carb_g: r1(pick("carbohydrates") ?? 0),
      fat_g: r1(pick("fat") ?? 0),
    },
    nutrients: {
      fiber_g: pick("fiber") === null ? null : r1(pick("fiber") as number),
      sugar_g: pick("sugars") === null ? null : r1(pick("sugars") as number),
      sodium_mg: sodiumG === null ? null : r0(sodiumG * 1000),
    },
  };
}

// --- USDA FoodData Central ----------------------------------------------------

export type UsdaFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: Array<{ nutrientId?: number; unitName?: string; value?: number }>;
};

/** FoodData Central nutrient ids. */
const USDA = { kcal: 1008, protein: 1003, fat: 1004, carbs: 1005, fiber: 1079, sugar: 2000, sodium: 1093 } as const;

export function normaliseUsda(f: UsdaFood): DbFood | null {
  const nutrients = f.foodNutrients ?? [];
  const per100 = (id: number): number | null => {
    const hit = nutrients.find((x) => x.nutrientId === id);
    return hit ? finite(hit.value) : null;
  };
  const kcal100 = per100(USDA.kcal);
  if (kcal100 === null || !f.description) return null;

  const unit = f.servingSizeUnit?.toLowerCase();
  const size = finite(f.servingSize);
  // Search results are per 100 g (or ml); a gram/ml serving size lets us scale.
  const scalable = size !== null && (unit === "g" || unit === "ml" || unit === "grm" || unit === "mlt");
  const factor = scalable && size ? size / 100 : 1;
  const at = (id: number) => {
    const v = per100(id);
    return v === null ? null : v * factor;
  };
  const unitLabel = unit === "ml" || unit === "mlt" ? "ml" : "g";
  const household = f.householdServingFullText?.trim();

  return {
    source: "usda",
    sourceLabel: f.dataType === "Branded" ? "USDA (branded)" : "USDA",
    id: String(f.fdcId),
    name: tidyName(f.description),
    brand: f.brandName ? tidyName(f.brandName) : f.brandOwner ? tidyName(f.brandOwner) : null,
    servingLabel: scalable ? (household ? `${household.toLowerCase()} (${size} ${unitLabel})` : `${size} ${unitLabel}`) : "100 g",
    per100g: !scalable,
    barcode: f.gtinUpc && /^[0-9]{6,14}$/.test(f.gtinUpc) ? f.gtinUpc : null,
    macros: {
      kcal: r0(kcal100 * factor),
      protein_g: r1(at(USDA.protein) ?? 0),
      carb_g: r1(at(USDA.carbs) ?? 0),
      fat_g: r1(at(USDA.fat) ?? 0),
    },
    nutrients: {
      fiber_g: at(USDA.fiber) === null ? null : r1(at(USDA.fiber) as number),
      sugar_g: at(USDA.sugar) === null ? null : r1(at(USDA.sugar) as number),
      sodium_mg: at(USDA.sodium) === null ? null : r0(at(USDA.sodium) as number),
    },
  };
}

/** Interleave the two sources and drop near-duplicates (same name and brand). */
export function mergeResults(usda: readonly DbFood[], off: readonly DbFood[], limit = 12): DbFood[] {
  const out: DbFood[] = [];
  const seen = new Set<string>();
  const max = Math.max(usda.length, off.length);
  for (let i = 0; i < max && out.length < limit; i++) {
    for (const f of [usda[i], off[i]]) {
      if (!f || out.length >= limit) continue;
      const key = `${f.name.toLowerCase()}|${(f.brand ?? "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

/** UPC-A/EAN-13 codes differ by a leading zero between sources; try both. */
export function barcodeVariants(code: string): string[] {
  const digits = code.replace(/\D/g, "");
  const set = new Set([digits]);
  if (digits.length === 12) set.add(`0${digits}`);
  if (digits.length === 13 && digits.startsWith("0")) set.add(digits.slice(1));
  return [...set];
}
