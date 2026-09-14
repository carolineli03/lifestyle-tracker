import { describe, expect, it } from "vitest";
import { parseLoose, stripFences } from "../src/lib/ai/parse.js";
import { CookResponse, EstimateResponse, SortResponse } from "../src/lib/ai/schemas.js";

const eggs = { name: "2 scrambled eggs", kcal: 182, protein: 12.2, carbs: 2, fat: 13.6 };

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

  it("validates a cook idea including its uses list", () => {
    const idea = { name: "Chicken fried rice", kcal: 520, protein: 38, carbs: 55, fat: 14, minutes: 25, method: "Fry it.", uses: ["Chicken thighs", "Rice"] };
    expect(parseLoose(JSON.stringify({ items: [idea] }), CookResponse).ok).toBe(true);
  });
});
