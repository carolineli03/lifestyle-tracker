import { handleAi } from "@/lib/ai/server";
import { IMPORT_RECIPE_SYSTEM, importRecipeMessage } from "@/lib/ai/prompts";
import { ImportRecipeRequest, ImportedRecipe } from "@/lib/ai/schemas";

export const maxDuration = 60;

/** Pasted recipe text → name, servings, ingredients, method. Filled into a form for review, never saved directly. */
export function POST(request: Request): Promise<Response> {
  return handleAi(request, ImportRecipeRequest, async (body) => ({
    route: "import-recipe",
    system: IMPORT_RECIPE_SYSTEM,
    user: importRecipeMessage(body.text),
    schema: ImportedRecipe,
    effort: "low",
  }));
}
