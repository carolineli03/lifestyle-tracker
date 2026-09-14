import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { barcodeVariants, mergeResults, rankUsda, normaliseOff, normaliseUsda, tidyName } from "../src/lib/fooddb.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => JSON.parse(readFileSync(path.join(here, "fixtures", name), "utf8"));

// Real responses captured from the live APIs, trimmed to the fields we read.

describe("normaliseOff", () => {
  it("uses the label's own per-serving figures and converts sodium to mg", () => {
    const f = normaliseOff(fixture("off-product.json").product);
    expect(f).toMatchObject({
      source: "off",
      brand: "Simply Asia",
      servingLabel: "0.333 PACKAGE (52 g)",
      per100g: false,
      barcode: "0737628064502",
      macros: { kcal: 200, protein_g: 5, carb_g: 37, fat_g: 4 },
      nutrients: { fiber_g: 1, sugar_g: 7, sodium_mg: 150 },
    });
  });

  it("falls back to per 100 g, and says so, when there's no serving size", () => {
    const hit = fixture("off-search.json").hits[0];
    const f = normaliseOff(hit);
    expect(f).toMatchObject({
      name: "Nonfat Greek Yogurt",
      brand: "Chobani",
      servingLabel: "100 g",
      per100g: true,
      macros: { kcal: 53, protein_g: 9.4, carb_g: 3.5, fat_g: 0 },
      nutrients: { fiber_g: null, sugar_g: 3.5, sodium_mg: 38 },
    });
  });

  it("scales per-100 g values by serving weight when only the weight is known", () => {
    const f = normaliseOff({
      code: "123456789012",
      product_name: "Oat bar",
      serving_quantity: 40,
      nutriments: { "energy-kcal_100g": 450, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 20, sodium_100g: 0.2 },
    });
    expect(f?.macros).toEqual({ kcal: 180, protein_g: 4, carb_g: 24, fat_g: 8 });
    expect(f?.nutrients.sodium_mg).toBe(80);
    expect(f?.servingLabel).toBe("40 g");
  });

  it("skips products with no calorie figure rather than inventing one", () => {
    expect(normaliseOff({ product_name: "Mystery", nutriments: {} })).toBeNull();
  });
});

describe("normaliseUsda", () => {
  const [branded, legacy] = fixture("usda-search.json").foods;

  it("scales a branded food's per-100 g values to its serving", () => {
    const f = normaliseUsda(branded);
    // 170 g serving: 88 kcal/100 g × 1.7 = 149.6
    expect(f).toMatchObject({
      source: "usda",
      sourceLabel: "USDA (branded)",
      name: "Greek Yogurt Plain",
      brand: "Velvet-View Farmstead",
      servingLabel: "6 onz (170 g)",
      per100g: false,
      barcode: "850055003033",
      macros: { kcal: 150, protein_g: 8, carb_g: 6, fat_g: 11 },
      nutrients: { fiber_g: 0, sugar_g: 5, sodium_mg: 54 },
    });
  });

  it("keeps a generic food per 100 g", () => {
    const f = normaliseUsda(legacy);
    expect(f?.per100g).toBe(true);
    expect(f?.servingLabel).toBe("100 g");
    expect(f?.macros.kcal).toBe(73);
    expect(f?.name).toBe("Yogurt, Greek, plain, lowfat");
  });
});

describe("helpers", () => {
  it("title-cases only SHOUTED names", () => {
    expect(tidyName("GREEK YOGURT PLAIN")).toBe("Greek Yogurt Plain");
    expect(tidyName("Yogurt, Greek, plain")).toBe("Yogurt, Greek, plain");
    expect(tidyName("TRADER JOE'S GREEK YOGURT")).toBe("Trader Joe's Greek Yogurt");
    expect(tidyName("LOW-FAT (PLAIN) YOGURT")).toBe("Low-Fat (Plain) Yogurt");
  });

  it("interleaves sources and drops duplicates", () => {
    const a = normaliseUsda(fixture("usda-search.json").foods[0])!;
    const b = normaliseOff(fixture("off-search.json").hits[0])!;
    const merged = mergeResults([a, a], [b]);
    expect(merged.map((f) => f.source)).toEqual(["usda", "off"]);
  });

  it("puts generic USDA foods ahead of branded ones", () => {
    const [branded, legacy] = fixture("usda-search.json").foods.map(normaliseUsda);
    expect(rankUsda([branded, legacy], "greek yogurt").map((f) => f?.sourceLabel)).toEqual(["USDA", "USDA (branded)"]);
  });

  it("ranks the plain raw food first, using USDA's real order for \"banana\"", () => {
    const usda = (description: string, dataType = "SR Legacy") =>
      normaliseUsda({ fdcId: description.length, description, dataType, foodNutrients: [{ nutrientId: 1008, value: 100 }] })!;
    // The order the live API returned.
    const live = [
      usda("BANANA", "Branded"),
      usda("Bananas, dehydrated, or banana powder"),
      usda("Bananas, raw"),
      usda("Bananas, overripe, raw", "Foundation"),
      usda("Melon, banana (Navajo)"),
      usda("Pepper, banana, raw"),
      usda("Babyfood, apple-banana juice"),
    ];
    expect(rankUsda(live, "banana").map((f) => f.name).slice(0, 4)).toEqual([
      "Bananas, raw",
      "Bananas, overripe, raw",
      "Bananas, dehydrated, or banana powder",
      "Pepper, banana, raw",
    ]);
  });

  it("tries UPC-A and EAN-13 forms of a barcode", () => {
    expect(barcodeVariants("737628064502")).toEqual(["737628064502", "0737628064502"]);
    expect(barcodeVariants("0737628064502")).toEqual(["0737628064502", "737628064502"]);
  });
});
