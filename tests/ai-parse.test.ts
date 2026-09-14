import { describe, expect, it } from "vitest";
import { parseLoose, stripFences } from "../src/lib/ai/parse.js";
import { CookResponse, EstimateResponse, ImportedRecipe, SortResponse } from "../src/lib/ai/schemas.js";

const eggs = { name: "2 scrambled eggs", kcal: 182, protein: 12.2, carbs: 2, fat: 13.6, fiber_g: 0, sugar_g: 0.4, sodium_mg: 340 };

describe("stripFences", () => {
  it("leaves bare JSON alone", () => {
    expect(stripFences('  {"items":[]}  ')).toBe('{"items":[]}');
  });

  it("unwraps a ```json fence", () => {
    expect(stripFences('```json\n{"items":[]}\n```')).toBe('{"items":[]}');
  });

  it("unwraps an unlabelled fence", () => {
    expect(stripFences('```\n[1,2]\n```')).toBe("[1,2]");
  });

  it("digs JSON out of surrounding prose", () => {
    expect(stripFences('Here you go:\n{"items":[]}\nEnjoy!')).toBe('{"items":[]}');
  });
});

describe("parseLoose", () => {
  it("validates a well-formed reply", () => {
    const r = parseLoose(JSON.stringify({ items: [eggs] }), EstimateResponse);
    expect(r).toEqual({ ok: true, value: { items: [eggs] } });
  });

  it("accepts a fenced reply", () => {
    const r = parseLoose("```json\n" + JSON.stringify({ items: [eggs] }) + "\n```", EstimateResponse);
    expect(r.ok).toBe(true);
  });

  it("accepts a bare array where { items } was expected", () => {
    const r = parseLoose(JSON.stringify([eggs]), EstimateResponse);
    expect(r).toEqual({ ok: true, value: { items: [eggs] } });
  });

  it("rejects non-JSON without inventing anything", () => {
    expect(parseLoose("Sorry, I can't help with that.", EstimateResponse)).toEqual({
      ok: false,
      reason: "The reply wasn't valid JSON.",
    });
  });

  it("rejects a reply with a missing number rather than defaulting it", () => {
    const r = parseLoose(JSON.stringify({ items: [{ name: "toast", kcal: 120 }] }), EstimateResponse);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("items.0");
  });

  it("rejects a storage location outside the enum", () => {
    const r = parseLoose(
      JSON.stringify({ items: [{ name: "milk", quantity: null, location: "garage", shelf_life_days: 7 }] }),
      SortResponse,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects fractional shelf life days", () => {
    const r = parseLoose(
      JSON.stringify({ items: [{ name: "milk", quantity: "1 gal", location: "fridge", shelf_life_days: 6.5 }] }),
      SortResponse,
    );
    expect(r.ok).toBe(false);
  });

  it("validates a cook idea including its uses and ingredients", () => {
    const idea = { name: "Chicken fried rice", kcal: 520, protein: 38, carbs: 55, fat: 14, minutes: 25, method: "Fry it.", uses: ["Chicken thighs", "Rice"], ingredients: ["6 oz chicken thighs", "1 cup cooked rice"] };
    expect(parseLoose(JSON.stringify({ items: [idea] }), CookResponse).ok).toBe(true);
  });
});

describe("ImportedRecipe", () => {
  it("accepts a recipe that doesn't say how many it serves", () => {
    const reply = { name: "Chili", servings: null, ingredients: ["2 lb beef"], method: "1. Cook.", per_serving: null };
    expect(parseLoose(JSON.stringify(reply), ImportedRecipe)).toEqual({ ok: true, value: reply });
  });

  it("rejects a recipe with ingredients as one blob instead of lines", () => {
    const reply = { name: "Chili", servings: 6, ingredients: "2 lb beef, 1 onion", method: "Cook.", per_serving: null };
    expect(parseLoose(JSON.stringify(reply), ImportedRecipe).ok).toBe(false);
  });
});
