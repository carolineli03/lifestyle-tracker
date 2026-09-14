import { handleAi } from "@/lib/ai/server";
import { loadKitchen } from "@/lib/ai/kitchen";
import { COOK_SYSTEM, cookMessage } from "@/lib/ai/prompts";
import { CookRequest, CookResponse } from "@/lib/ai/schemas";

export const maxDuration = 60;

/** Three meal ideas from what's on hand, soonest-expiring first. */
export function POST(request: Request): Promise<Response> {
  return handleAi(request, CookRequest, async (body, ctx) => {
    const kitchen = await loadKitchen(ctx, body.date);
    if ("ok" in kitchen) return kitchen;
    return {
      route: "cook",
      system: COOK_SYSTEM,
      user: cookMessage(kitchen.pantry, body.date, kitchen.budget, body.meal),
      schema: CookResponse,
      effort: "medium",
    };
  });
}
