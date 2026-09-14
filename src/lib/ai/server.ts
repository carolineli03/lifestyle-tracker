import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { supabaseServer } from "@/lib/supabase/server";
import { fail, runStructured, type AiDeps, type AiOutcome } from "./core";
import { AI_MODEL, type AiErrorBody, type AiRoute } from "./schemas";

/**
 * Route-handler glue: authenticate, build real dependencies, turn the outcome
 * into a Response. Each route file only supplies its prompt and schema.
 */

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;

export type AiContext = { supabase: Supabase; userId: string };

export type AiJob<S extends z.ZodType> = {
  route: AiRoute;
  system: string;
  user: string;
  schema: S;
  effort: "low" | "medium";
};

let client: Anthropic | null = null;
function anthropic(apiKey: string): Anthropic {
  // 45s per attempt and one retry keeps a request inside the route's 60s
  // budget in the common case; the browser gives up at 60s regardless.
  client ??= new Anthropic({ apiKey, timeout: 45_000, maxRetries: 1 });
  return client;
}

function realDeps({ supabase, userId }: AiContext): AiDeps {
  const apiKey = serverEnv.anthropicApiKey;
  return {
    apiKey,
    now: () => new Date(),
    async recentCalls(since) {
      const { data, error } = await supabase
        .from("ai_usage")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw new Error(`Could not check AI usage: ${error.message}`);
      return (data ?? []).map((r) => new Date(r.created_at));
    },
    async logUsage(row) {
      const { error } = await supabase.from("ai_usage").insert({ ...row, user_id: userId });
      if (error) throw new Error(error.message);
    },
    async callModel({ system, user, schema, effort }) {
      const format = zodOutputFormat(schema);
      const message = await anthropic(apiKey ?? "").messages.create({
        model: AI_MODEL,
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: user }],
        // Only the schema goes over the wire; validation happens in core.ts
        // so a failed parse still reports its tokens and stop reason.
        output_config: { effort, format: { type: format.type, schema: format.schema } },
      });
      const text = message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      return {
        stopReason: message.stop_reason,
        text,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
    },
  };
}

export function errorResponse(status: number, code: AiErrorBody["error"]["code"], message: string): Response {
  const body: AiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

function toResponse<T>(outcome: AiOutcome<T>): Response {
  return outcome.ok ? Response.json({ data: outcome.data }) : errorResponse(outcome.status, outcome.code, outcome.message);
}

/**
 * The shape every AI route shares. `prepare` validates the body and builds the
 * prompt; it may return a failure (bad input, empty kitchen) to skip the model
 * call entirely — no tokens spent on a request that can't succeed.
 */
export async function handleAi<B extends z.ZodType, S extends z.ZodType>(
  request: Request,
  bodySchema: B,
  prepare: (body: z.infer<B>, ctx: AiContext) => Promise<AiJob<S> | ReturnType<typeof fail>>,
): Promise<Response> {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse(401, "unauthenticated", "You're signed out. Sign in again and retry.");

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return errorResponse(400, "bad_request", "The request body wasn't JSON.");
    }
    const body = bodySchema.safeParse(raw);
    if (!body.success) {
      return errorResponse(400, "bad_request", body.error.issues[0]?.message ?? "That request wasn't valid.");
    }

    const ctx: AiContext = { supabase, userId: user.id };
    const job = await prepare(body.data, ctx);
    if ("ok" in job) return toResponse(job);

    return toResponse(await runStructured(job, realDeps(ctx)));
  } catch (cause) {
    console.error("[ai] unhandled", cause);
    return errorResponse(500, "internal", "Something went wrong on the server. Nothing was saved.");
  }
}

/**
 * `date` comes from the phone (it's a local day). It must be within a day of
 * the server's UTC date — every real timezone is — so a malformed or far-off
 * value can't be used to read someone's history.
 */
export function plausibleLocalDate(iso: string, now = new Date()): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  const asUtc = Date.UTC(y, m - 1, d);
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(asUtc - todayUtc) <= 86_400_000;
}
