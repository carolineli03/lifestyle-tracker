import type { z } from "zod";

/**
 * Tolerant JSON extraction. Structured outputs should make this a no-op, but
 * the route must never trust that: a reply wrapped in a ```json fence, or
 * with a sentence before it, should still parse — and anything that doesn't
 * validate is an error, never a guess.
 */

export function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fenced?.[1] !== undefined) return fenced[1].trim();

  // Prose around a bare object/array: take the outermost bracketed span.
  const firstObj = trimmed.search(/[[{]/);
  if (firstObj > 0) {
    const open = trimmed[firstObj];
    const close = open === "{" ? "}" : "]";
    const last = trimmed.lastIndexOf(close);
    if (last > firstObj) return trimmed.slice(firstObj, last + 1);
  }
  return trimmed;
}

export type ParseOutcome<T> = { ok: true; value: T } | { ok: false; reason: string };

export function parseLoose<S extends z.ZodType>(text: string, schema: S): ParseOutcome<z.infer<S>> {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(text));
  } catch {
    return { ok: false, reason: "The reply wasn't valid JSON." };
  }

  // A bare array where a wrapped `{ items }` was expected is the classic
  // prompt-only shape; accept it rather than failing on a technicality.
  if (Array.isArray(json)) json = { items: json };

  const result = schema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` at ${first.path.join(".")}` : "";
    return { ok: false, reason: `The reply didn't match the expected shape${where}.` };
  }
  return { ok: true, value: result.data };
}
