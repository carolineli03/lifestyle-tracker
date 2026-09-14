import { describe, expect, it } from "vitest";
import { usageTotals } from "../src/lib/ai/cost.js";

describe("usageTotals", () => {
  it("prices Sonnet 5 at $2 in / $10 out per million tokens", () => {
    const t = usageTotals([
      { model: "claude-sonnet-5", input_tokens: 500_000, output_tokens: 100_000, ok: true },
      { model: "claude-sonnet-5", input_tokens: 500_000, output_tokens: 0, ok: false },
    ]);
    expect(t).toEqual({ calls: 2, failed: 1, inputTokens: 1_000_000, outputTokens: 100_000, dollars: 3 });
  });

  it("costs an unknown model at the current rate instead of free", () => {
    expect(usageTotals([{ model: "claude-future", input_tokens: 1_000_000, output_tokens: 0, ok: true }]).dollars).toBe(2);
  });

  it("is zero for a quiet month", () => {
    expect(usageTotals([])).toEqual({ calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, dollars: 0 });
  });
});
