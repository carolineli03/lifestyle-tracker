import { handleAi } from "@/lib/ai/server";
import { SORT_SYSTEM, sortMessage } from "@/lib/ai/prompts";
import { SortRequest, SortResponse } from "@/lib/ai/schemas";

export const maxDuration = 60;

/** A pasted grocery haul → items with a location and shelf life, for confirmation. */
export function POST(request: Request): Promise<Response> {
  return handleAi(request, SortRequest, async (body) => ({
    route: "sort-groceries",
    system: SORT_SYSTEM,
    user: sortMessage(body.text),
    schema: SortResponse,
    effort: "low",
  }));
}
