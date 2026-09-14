import { AI_MODEL, AI_PRICING } from "./schemas";

export type UsageTotals = {
  calls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD from the published per-token prices. */
  dollars: number;
};

/**
 * Rough monthly spend. Rows logged under a model with no price on file are
 * costed at the current model's rate rather than silently counted as free.
 */
export function usageTotals(rows: readonly { model: string; input_tokens: number; output_tokens: number; ok: boolean }[]): UsageTotals {
  const fallback = AI_PRICING[AI_MODEL] ?? { input: 0, output: 0 };
  return rows.reduce<UsageTotals>(
    (t, r) => {
      const price = AI_PRICING[r.model] ?? fallback;
      return {
        calls: t.calls + 1,
        failed: t.failed + (r.ok ? 0 : 1),
        inputTokens: t.inputTokens + r.input_tokens,
        outputTokens: t.outputTokens + r.output_tokens,
        dollars: t.dollars + (r.input_tokens * price.input + r.output_tokens * price.output) / 1_000_000,
      };
    },
    { calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, dollars: 0 },
  );
}
