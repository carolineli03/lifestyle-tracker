import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { classifyError, runStructured, type AiDeps, type ModelReply } from "../src/lib/ai/core.js";
import { AI_CALLS_PER_DAY_ALL, AI_CALLS_PER_HOUR, EstimateResponse } from "../src/lib/ai/schemas.js";

const NOW = new Date("2026-09-13T18:00:00Z");
const eggs = { name: "2 scrambled eggs", kcal: 182, protein: 12.2, carbs: 2, fat: 13.6 };

function harness(opts: { reply?: ModelReply; throws?: unknown; recent?: Date[]; everyone?: number; apiKey?: string | undefined } = {}) {
  const logged: Parameters<AiDeps["logUsage"]>[0][] = [];
  let calls = 0;
  const deps: AiDeps = {
    apiKey: "apiKey" in opts ? opts.apiKey : "sk-test",
    now: () => NOW,
    recentCalls: async () => opts.recent ?? [],
    globalCallsSince: async () => opts.everyone ?? 0,
    logUsage: async (row) => {
      logged.push(row);
    },
    callModel: async () => {
      calls += 1;
      if (opts.throws) throw opts.throws;
      return opts.reply ?? { stopReason: "end_turn", text: JSON.stringify({ items: [eggs] }), inputTokens: 410, outputTokens: 96 };
    },
  };
  return { deps, logged, calls: () => calls };
}

const job = { route: "estimate" as const, system: "sys", user: "2 eggs", schema: EstimateResponse, effort: "low" as const };

describe("runStructured", () => {
  it("returns validated data and logs the tokens", async () => {
    const h = harness();
    const out = await runStructured(job, h.deps);
    expect(out).toEqual({ ok: true, data: { items: [eggs] } });
    expect(h.logged).toEqual([
      { route: "estimate", model: "claude-sonnet-5", input_tokens: 410, output_tokens: 96, ok: true },
    ]);
  });

  it("recovers a fenced reply", async () => {
    const h = harness({ reply: { stopReason: "end_turn", text: "```json\n" + JSON.stringify({ items: [eggs] }) + "\n```", inputTokens: 1, outputTokens: 1 } });
    expect((await runStructured(job, h.deps)).ok).toBe(true);
  });

  it("refuses to fabricate numbers from an unusable reply, and still logs the spend", async () => {
    const h = harness({ reply: { stopReason: "end_turn", text: '{"items":[{"name":"toast"}]}', inputTokens: 300, outputTokens: 20 } });
    const out = await runStructured(job, h.deps);
    expect(out).toMatchObject({ ok: false, status: 502, code: "bad_response" });
    expect(h.logged[0]).toMatchObject({ input_tokens: 300, output_tokens: 20, ok: false });
  });

  it("reports a refusal as its own error", async () => {
    const h = harness({ reply: { stopReason: "refusal", text: "", inputTokens: 50, outputTokens: 0 } });
    expect(await runStructured(job, h.deps)).toMatchObject({ ok: false, code: "refused" });
  });

  it("reports a truncated reply as its own error", async () => {
    const h = harness({ reply: { stopReason: "max_tokens", text: '{"items":[', inputTokens: 50, outputTokens: 16000 } });
    expect(await runStructured(job, h.deps)).toMatchObject({ ok: false, code: "truncated" });
  });

  it("stops at the hourly limit without calling the model", async () => {
    const oldest = new Date(NOW.getTime() - 50 * 60_000);
    const recent = Array.from({ length: AI_CALLS_PER_HOUR }, (_, i) => new Date(oldest.getTime() + i * 1000));
    const h = harness({ recent });
    const out = await runStructured(job, h.deps);
    expect(out).toMatchObject({ ok: false, status: 429, code: "rate_limited" });
    if (!out.ok) expect(out.message).toContain("Try again in 10 min");
    expect(h.calls()).toBe(0);
    expect(h.logged).toEqual([]);
  });

  it("stops every account once the whole app hits its daily cap", async () => {
    const h = harness({ everyone: AI_CALLS_PER_DAY_ALL });
    const out = await runStructured(job, h.deps);
    expect(out).toMatchObject({ ok: false, status: 429, code: "rate_limited" });
    if (!out.ok) expect(out.message).toContain("daily AI limit");
    expect(h.calls()).toBe(0);
  });

  it("allows the call just under the limit", async () => {
    const recent = Array.from({ length: AI_CALLS_PER_HOUR - 1 }, () => new Date(NOW.getTime() - 60_000));
    const h = harness({ recent });
    expect((await runStructured(job, h.deps)).ok).toBe(true);
  });

  it("says AI isn't set up when there is no key, without calling anything", async () => {
    const h = harness({ apiKey: undefined });
    expect(await runStructured(job, h.deps)).toMatchObject({ ok: false, status: 503, code: "not_configured" });
    expect(h.calls()).toBe(0);
  });

  it("logs a failed call with zero tokens and maps the error", async () => {
    const h = harness({ throws: Anthropic.APIError.generate(401, { error: { type: "authentication_error" } }, "invalid x-api-key", new Headers()) });
    expect(await runStructured(job, h.deps)).toMatchObject({ ok: false, code: "upstream_auth" });
    expect(h.logged).toEqual([{ route: "estimate", model: "claude-sonnet-5", input_tokens: 0, output_tokens: 0, ok: false }]);
  });

  it("still returns the result if the usage log write fails", async () => {
    const h = harness();
    h.deps.logUsage = async () => {
      throw new Error("db down");
    };
    const original = console.error;
    console.error = () => undefined;
    try {
      expect((await runStructured(job, h.deps)).ok).toBe(true);
    } finally {
      console.error = original;
    }
  });
});

describe("classifyError", () => {
  const gen = (status: number) => Anthropic.APIError.generate(status, { error: {} }, "x", new Headers());

  it("maps the SDK's typed errors, most specific first", () => {
    expect(classifyError(new Anthropic.APIConnectionTimeoutError())).toMatchObject({ code: "upstream_busy" });
    expect(classifyError(new Anthropic.APIConnectionError({ message: "offline" }))).toMatchObject({ code: "upstream_busy" });
    expect(classifyError(gen(401))).toMatchObject({ code: "upstream_auth", status: 500 });
    expect(classifyError(gen(403))).toMatchObject({ code: "upstream_auth" });
    expect(classifyError(gen(429))).toMatchObject({ code: "upstream_busy", status: 503 });
    expect(classifyError(gen(529))).toMatchObject({ code: "upstream_busy" });
    expect(classifyError(gen(400))).toMatchObject({ code: "upstream_error", status: 502 });
    expect(classifyError(new Error("boom"))).toMatchObject({ code: "internal", status: 500 });
  });
});
