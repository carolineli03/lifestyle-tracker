import { handleAi } from "@/lib/ai/server";
import { loadKitchen } from "@/lib/ai/kitchen";
import { PREP_SYSTEM, prepMessage } from "@/lib/ai/prompts";
import { PrepPlanRequest, PrepPlanResponse } from "@/lib/ai/schemas";

export const maxDuration = 60;

/** A Sunday batch prep: 2–3 components that make `servings` lunches. */
export function POST(request: Request): Promise<Response> {
  return handleAi(request, PrepPlanRequest, async (body, ctx) => {
    const kitchen = await loadKitchen(ctx, body.date);
    if ("ok" in kitchen) return kitchen;
    return {
      route: "prep-plan",
      system: PREP_SYSTEM,
      user: prepMessage(kitchen.pantry, body.date, body.servings, kitchen.budget.kcalTarget),
      schema: PrepPlanResponse,
      effort: "medium",
    };
  });
}
