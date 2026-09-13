import { describe, expect, it } from "vitest";
import { addDays, describeDate, fromIsoDate, isFuture, toIsoDate, weekBounds } from "../src/lib/date.js";

describe("local calendar dates", () => {
  it("formats a Date as its LOCAL day, not its UTC one", () => {
    // 11pm on 13 September, local time. toISOString() would call this the 14th
    // anywhere east of UTC, which is exactly the bug this avoids.
    const lateEvening = new Date(2026, 8, 13, 23, 30, 0);
    expect(toIsoDate(lateEvening)).toBe("2026-09-13");
  });

  it("round-trips through local midnight", () => {
    const d = fromIsoDate("2026-09-13");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(13);
    expect(d.getHours()).toBe(0);
  });

  it("steps across a month boundary", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("steps across a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("knows what is in the future", () => {
    expect(isFuture("2026-09-14", "2026-09-13")).toBe(true);
    expect(isFuture("2026-09-13", "2026-09-13")).toBe(false);
    expect(isFuture("2026-09-12", "2026-09-13")).toBe(false);
  });
});

describe("weekBounds", () => {
  it("starts the week on Monday", () => {
    // 2026-09-13 is a Sunday, so it belongs to the week starting Monday the 7th.
    expect(weekBounds("2026-09-13")).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });

  it("leaves a Monday where it is", () => {
    expect(weekBounds("2026-09-07")).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });

  it("spans a month boundary without losing days", () => {
    expect(weekBounds("2026-10-01")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
  });
});

describe("describeDate", () => {
  it("names the days close to now", () => {
    expect(describeDate("2026-09-13", "2026-09-13")).toBe("Today");
    expect(describeDate("2026-09-12", "2026-09-13")).toBe("Yesterday");
    expect(describeDate("2026-09-14", "2026-09-13")).toBe("Tomorrow");
  });

  it("falls back to a real date further out", () => {
    const label = describeDate("2026-09-01", "2026-09-13");
    expect(label).not.toMatch(/Today|Yesterday|Tomorrow/);
    expect(label).toMatch(/Sep/);
  });
});
