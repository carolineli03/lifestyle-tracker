import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../src/lib/csv.js";

describe("csvCell", () => {
  it("leaves plain values alone and blanks nulls", () => {
    expect(csvCell("Oats")).toBe("Oats");
    expect(csvCell(320)).toBe("320");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("Toast, buttered")).toBe('"Toast, buttered"');
    expect(csvCell('6" sub')).toBe('"6"" sub"');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("defuses spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1 cup")).toBe("'+1 cup");
    // …but a negative number is still a number.
    expect(csvCell(-1.8)).toBe("-1.8");
  });
});

describe("toCsv", () => {
  it("writes a header, rows in column order, CRLF endings and a BOM", () => {
    const out = toCsv(
      [
        { date: "2026-09-14", name: "Oats", kcal: 320 },
        { date: "2026-09-14", name: "Coffee, black", kcal: 5 },
      ],
      ["date", "name", "kcal"],
    );
    expect(out).toBe("﻿date,name,kcal\r\n2026-09-14,Oats,320\r\n2026-09-14,\"Coffee, black\",5\r\n");
  });
});
