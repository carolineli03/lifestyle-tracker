import { handleAi } from "@/lib/ai/server";
import { ESTIMATE_SYSTEM, estimateMessage } from "@/lib/ai/prompts";
import { EstimateRequest, EstimateResponse } from "@/lib/ai/schemas";

export const maxDuration = 60;

/** "2 scrambled eggs, sourdough with butter" → itemised macros, for confirmation. */
export function POST(request: Request): Promise<Response> {
  return handleAi(request, EstimateRequest, async (body) => ({
    route: "estimate",
    system: ESTIMATE_SYSTEM,
    user: estimateMessage(body.text),
    schema: EstimateResponse,
    effort: "low",
  }));
}
