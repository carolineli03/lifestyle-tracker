import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { parseLoose } from "./parse";
import { AI_CALLS_PER_DAY_ALL, AI_CALLS_PER_HOUR, AI_MODEL, type AiErrorCode, type AiRoute } from "./schemas";

/**
 * The part of every AI route that is not specific to any one of them: rate
 * limit, call the model, validate what comes back, log the tokens.
 *
 * Everything with a side effect comes in through `AiDeps`, so this can be
 * tested without a network, a database or an API key.
 */

/** Plain text, or content blocks when a request carries an image. */
export type UserContent = string | Anthropic.ContentBlockParam[];

export type ModelReply = {
  stopReason: string | null;
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export type AiDeps = {
  apiKey: string | undefined;
  now: () => Date;
  /** This user's calls since `since`, oldest first (only timestamps needed). */
  recentCalls: (since: Date) => Promise<Date[]>;
  /** Calls by everyone since `since` — a bare count, nothing else. */
  globalCallsSince: (since: Date) => Promise<number>;
  logUsage: (row: { route: AiRoute; model: string; input_tokens: number; output_tokens: number; ok: boolean }) => Promise<void>;
  callModel: (args: { system: string; user: UserContent; schema: z.ZodType; effort: "low" | "medium" }) => Promise<ModelReply>;
};

export type AiFailure = { ok: false; status: number; code: AiErrorCode; message: string };
export type AiOutcome<T> = { ok: true; data: T } | AiFailure;

export function fail(status: number, code: AiErrorCode, message: string): AiFailure {
  return { ok: false, status, code, message };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export async function runStructured<S extends z.ZodType>(
  job: { route: AiRoute; system: string; user: UserContent; schema: S; effort: "low" | "medium" },
  deps: AiDeps,
): Promise<AiOutcome<z.infer<S>>> {
  if (!deps.apiKey) {
    return fail(503, "not_configured", "AI features aren't set up yet — ANTHROPIC_API_KEY is missing on the server. You can still enter things by hand.");
  }

  const now = deps.now();
  const recent = await deps.recentCalls(new Date(now.getTime() - HOUR_MS));
  if (recent.length >= AI_CALLS_PER_HOUR) {
    const oldest = recent[0] ?? now;
    const minutes = Math.max(1, Math.ceil((oldest.getTime() + HOUR_MS - now.getTime()) / 60_000));
    return fail(
      429,
      "rate_limited",
      `That's ${AI_CALLS_PER_HOUR} AI requests in the last hour, which is the limit. Try again in ${minutes} min, or enter it by hand.`,
    );
  }

  const everyone = await deps.globalCallsSince(new Date(now.getTime() - DAY_MS));
  if (everyone >= AI_CALLS_PER_DAY_ALL) {
    return fail(
      429,
      "rate_limited",
      "The app has hit its daily AI limit, which keeps the bill in check. It resets over the next 24 hours — until then, enter things by hand.",
    );
  }

  let reply: ModelReply;
  try {
    reply = await deps.callModel({ system: job.system, user: job.user, schema: job.schema, effort: job.effort });
  } catch (cause) {
    await safeLog(deps, { route: job.route, model: AI_MODEL, input_tokens: 0, output_tokens: 0, ok: false });
    return classifyError(cause);
  }

  const outcome = interpret(reply, job.schema);
  await safeLog(deps, {
    route: job.route,
    model: AI_MODEL,
    input_tokens: reply.inputTokens,
    output_tokens: reply.outputTokens,
    ok: outcome.ok,
  });
  return outcome;
}

function interpret<S extends z.ZodType>(reply: ModelReply, schema: S): AiOutcome<z.infer<S>> {
  if (reply.stopReason === "refusal") {
    return fail(422, "refused", "The model declined that request. Try rewording it, or enter it by hand.");
  }
  if (reply.stopReason === "max_tokens") {
    return fail(502, "truncated", "The reply got cut off before it finished. Try a shorter list.");
  }
  const parsed = parseLoose(reply.text, schema);
  if (!parsed.ok) {
    return fail(502, "bad_response", `The AI sent back something unusable (${parsed.reason}) Nothing was saved — try again or enter it by hand.`);
  }
  return { ok: true, data: parsed.value };
}

/** Most specific first: connection, auth, rate limit, then any other API error. */
export function classifyError(cause: unknown): AiFailure {
  if (cause instanceof Anthropic.APIConnectionTimeoutError) {
    return fail(503, "upstream_busy", "The AI took too long to answer. Try again in a moment.");
  }
  if (cause instanceof Anthropic.APIConnectionError) {
    return fail(503, "upstream_busy", "Couldn't reach the AI service. Try again in a moment.");
  }
  if (cause instanceof Anthropic.AuthenticationError || cause instanceof Anthropic.PermissionDeniedError) {
    return fail(500, "upstream_auth", "The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY.");
  }
  if (cause instanceof Anthropic.RateLimitError) {
    return fail(503, "upstream_busy", "The AI service is rate-limiting this account right now. Try again shortly.");
  }
  if (cause instanceof Anthropic.APIError) {
    const busy = cause.status !== undefined && cause.status >= 500;
    return busy
      ? fail(503, "upstream_busy", "The AI service is having trouble right now. Try again shortly.")
      : fail(502, "upstream_error", `The AI request failed (${cause.status ?? "no status"}).`);
  }
  return fail(500, "internal", "Something went wrong on the server while asking the AI.");
}

async function safeLog(deps: AiDeps, row: Parameters<AiDeps["logUsage"]>[0]): Promise<void> {
  try {
    await deps.logUsage(row);
  } catch (cause) {
    // A missing usage row costs an accurate bill, not the user's result.
    console.error("[ai] could not log usage", cause);
  }
}
