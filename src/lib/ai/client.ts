"use client";

import type { z } from "zod";
import type { AiErrorBody } from "./schemas";

/**
 * Browser side of the AI routes. One promise, one of two outcomes: typed data,
 * or an Error whose message is fit to show as-is. It always settles — the
 * 60-second abort means no spinner can outlive a hung request.
 */

const TIMEOUT_MS = 60_000;

export async function postAi<S extends z.ZodType>(
  path: "/api/estimate" | "/api/photo" | "/api/sort-groceries" | "/api/cook" | "/api/prep-plan" | "/api/import-recipe",
  body: unknown,
  schema: S,
): Promise<z.infer<S>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new Error("That took over a minute, so it was stopped. Try again, or enter it by hand.");
    }
    throw new Error("Couldn't reach the server — check your connection. You can still enter it by hand.");
  } finally {
    clearTimeout(timer);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`The server answered with something unreadable (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const message = (json as Partial<AiErrorBody>).error?.message;
    throw new Error(message ?? `The request failed (HTTP ${res.status}).`);
  }

  const parsed = schema.safeParse((json as { data?: unknown }).data);
  if (!parsed.success) throw new Error("The server's reply didn't have the expected shape. Nothing was saved.");
  return parsed.data;
}
