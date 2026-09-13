import { describe, expect, it } from "vitest";
import {
  byExpiry,
  daysUntil,
  expiringSoon,
  expiryLabel,
  expiryTone,
  groupByLocation,
  isoInDays,
} from "../src/lib/expiry.js";
import type { PantryItem } from "../src/lib/supabase/database.types.js";

const TODAY = "2026-09-13";

function item(partial: Partial<PantryItem> & { name: string }): PantryItem {
  return {
    household_id: "h",
    id: partial.name,
    quantity: null,
    location: "fridge",
    expires_on: null,
    created_by: null,
    created_at: "",
    ...partial,
  };
}

describe("daysUntil", () => {
  it("counts whole calendar days forward", () => {
    expect(daysUntil("2026-09-15", TODAY)).toBe(2);
    expect(daysUntil("2026-09-13", TODAY)).toBe(0);
  });

  it("goes negative once the date is past", () => {
    expect(daysUntil("2026-09-10", TODAY)).toBe(-3);
  });

  it("survives a month boundary", () => {
    expect(daysUntil("2026-10-01", "2026-09-28")).toBe(3);
  });

  it("survives a daylight-saving shift", () => {
    // Across a DST boundary a "day" is 23 or 25 hours. Rounding, rather than
    // flooring, is what keeps this from reporting 6 days instead of 7.
    expect(daysUntil("2026-11-08", "2026-11-01")).toBe(7);
    expect(daysUntil("2026-03-15", "2026-03-08")).toBe(7);
  });
});

describe("expiryTone", () => {
  it("is red at two days, already-today, and past", () => {
    expect(expiryTone("2026-09-15", TODAY)).toBe("urgent");
    expect(expiryTone("2026-09-13", TODAY)).toBe("urgent");
    expect(expiryTone("2026-09-11", TODAY)).toBe("gone");
  });

  it("is amber from three to five days", () => {
    expect(expiryTone("2026-09-16", TODAY)).toBe("soon");
    expect(expiryTone("2026-09-18", TODAY)).toBe("soon");
  });

  it("is neutral beyond five days", () => {
    expect(expiryTone("2026-09-19", TODAY)).toBe("calm");
  });

  it("leaves undated items alone", () => {
    expect(expiryTone(null, TODAY)).toBe("calm");
  });
});

describe("expiryLabel", () => {
  it("names the near days", () => {
    expect(expiryLabel("2026-09-13", TODAY)).toBe("Today");
    expect(expiryLabel("2026-09-14", TODAY)).toBe("Tomorrow");
    expect(expiryLabel("2026-09-17", TODAY)).toBe("4d left");
  });

  it("says how long ago something went", () => {
    expect(expiryLabel("2026-09-12", TODAY)).toBe("1d ago");
    expect(expiryLabel("2026-09-08", TODAY)).toBe("5d ago");
  });

  it("switches to a plain date past a month", () => {
    expect(expiryLabel("2026-10-13", TODAY)).toBe("30d left");
    const far = expiryLabel("2027-01-11", TODAY);
    expect(far).not.toMatch(/left/);
    expect(far).toMatch(/Jan/);
  });

  it("says nothing without a date", () => {
    expect(expiryLabel(null, TODAY)).toBeNull();
  });
});

describe("byExpiry", () => {
  it("floats the soonest-expiring to the top and sinks undated items", () => {
    const sorted = [
      item({ name: "Rice", expires_on: null }),
      item({ name: "Spinach", expires_on: "2026-09-14" }),
      item({ name: "Cheese", expires_on: "2026-09-20" }),
    ].sort(byExpiry);
    expect(sorted.map((i) => i.name)).toEqual(["Spinach", "Cheese", "Rice"]);
  });

  it("orders same-day items by name so the list is stable", () => {
    const sorted = [
      item({ name: "Yoghurt", expires_on: "2026-09-14" }),
      item({ name: "Apples", expires_on: "2026-09-14" }),
    ].sort(byExpiry);
    expect(sorted.map((i) => i.name)).toEqual(["Apples", "Yoghurt"]);
  });
});

describe("groupByLocation", () => {
  it("groups, orders each group by urgency, and drops empty locations", () => {
    const groups = groupByLocation([
      item({ name: "Peas", location: "freezer", expires_on: "2027-01-01" }),
      item({ name: "Milk", location: "fridge", expires_on: "2026-09-15" }),
      item({ name: "Kale", location: "fridge", expires_on: "2026-09-14" }),
    ]);
    expect(groups.map((g) => g.location)).toEqual(["fridge", "freezer"]);
    expect(groups[0]?.items.map((i) => i.name)).toEqual(["Kale", "Milk"]);
  });

  it("returns nothing for an empty kitchen", () => {
    expect(groupByLocation([])).toEqual([]);
  });
});

describe("expiringSoon", () => {
  it("picks up anything due within five days, including things already past", () => {
    const soon = expiringSoon(
      [
        item({ name: "Cream", expires_on: "2026-09-10" }),
        item({ name: "Kale", expires_on: "2026-09-16" }),
        item({ name: "Cheese", expires_on: "2026-09-30" }),
        item({ name: "Rice", expires_on: null }),
      ],
      TODAY,
    );
    expect(soon.map((i) => i.name)).toEqual(["Cream", "Kale"]);
  });
});

describe("isoInDays", () => {
  it("turns a shelf life into a use-by date", () => {
    expect(isoInDays(5, TODAY)).toBe("2026-09-18");
    expect(isoInDays(0, TODAY)).toBe(TODAY);
  });

  it("crosses a month end", () => {
    expect(isoInDays(4, "2026-09-30")).toBe("2026-10-04");
  });
});
