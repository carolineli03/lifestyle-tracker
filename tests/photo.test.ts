import { describe, expect, it } from "vitest";
import { fitWithin } from "../src/lib/image.js";
import { parseLoose } from "../src/lib/ai/parse.js";
import { PhotoRequest, PhotoResponse } from "../src/lib/ai/schemas.js";

describe("fitWithin", () => {
  it("shrinks a 12MP portrait photo to 1568 on the long edge, keeping the aspect ratio", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1176, height: 1568 });
  });

  it("shrinks landscape the same way", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1568, height: 1176 });
  });

  it("never upscales a small image", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("PhotoRequest", () => {
  const image = "A".repeat(200);

  it("accepts a base64 JPEG", () => {
    expect(PhotoRequest.safeParse({ image, mediaType: "image/jpeg" }).success).toBe(true);
  });

  it("refuses types the model can't read", () => {
    expect(PhotoRequest.safeParse({ image, mediaType: "image/heic" }).success).toBe(false);
  });

  it("refuses a data: URL prefix or other non-base64 junk", () => {
    expect(PhotoRequest.safeParse({ image: `data:image/jpeg;base64,${image}`, mediaType: "image/jpeg" }).success).toBe(false);
  });

  it("refuses an oversized upload before it reaches the model", () => {
    expect(PhotoRequest.safeParse({ image: "A".repeat(5_000_001), mediaType: "image/jpeg" }).success).toBe(false);
  });
});

describe("PhotoResponse", () => {
  it("reads a label result with its printed serving size", () => {
    const reply = {
      source: "label",
      items: [{ name: "Granola", serving_size: "2/3 cup (55g)", kcal: 240, protein: 6, carbs: 38, fat: 8, fiber_g: 4, sugar_g: 12, sodium_mg: null }],
    };
    expect(parseLoose(JSON.stringify(reply), PhotoResponse)).toEqual({ ok: true, value: reply });
  });

  it("does not let a bare array stand in for a photo result — source is required", () => {
    expect(parseLoose(JSON.stringify([{ name: "x" }]), PhotoResponse).ok).toBe(false);
  });
});
