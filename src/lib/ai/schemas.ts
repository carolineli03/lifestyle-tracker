import { z } from "zod";

/**
 * Response shapes for the four AI routes, shared by the server (to validate
 * what the model sends back) and the browser (to type what the route returns).
 *
 * Structured outputs need an object at the root, so each list is wrapped as
 * `{ items: [...] }` rather than being a bare array.
 */

export const AI_MODEL = "claude-sonnet-5";

/** USD per million tokens, for the monthly cost estimate on Progress. */
export const AI_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
};

/** Calls per user per rolling hour, across all four routes. */
export const AI_CALLS_PER_HOUR = 20;

export type AiRoute = "estimate" | "photo" | "sort-groceries" | "cook" | "prep-plan" | "import-recipe";

// --- estimate ---------------------------------------------------------------

export const EstimateItem = z.object({
  name: z.string(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});
export const EstimateResponse = z.object({ items: z.array(EstimateItem) });
export type EstimateItem = z.infer<typeof EstimateItem>;

export const EstimateRequest = z.object({
  text: z.string().trim().min(1, "Describe what you ate first.").max(2000, "That's a lot — keep it under 2,000 characters."),
});

// --- photo ------------------------------------------------------------------

/** base64 of a ≤ ~3.7 MB image; the browser downscales well below this. */
export const PHOTO_MAX_BASE64 = 5_000_000;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const PhotoRequest = z.object({
  image: z
    .string()
    .min(100, "That photo came through empty.")
    .max(PHOTO_MAX_BASE64, "That photo is too large. Try again — it's shrunk automatically.")
    .regex(/^[A-Za-z0-9+/]+=*$/, "That photo didn't upload correctly."),
  mediaType: z.enum(PHOTO_TYPES),
});

export const PhotoItem = z.object({
  name: z.string(),
  /** As printed on the label ("2/3 cup (55g)"), or a description of the portion shown. */
  serving_size: z.string().nullable(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});
export const PhotoResponse = z.object({
  source: z.enum(["label", "estimate"]),
  items: z.array(PhotoItem),
});
export type PhotoItem = z.infer<typeof PhotoItem>;
export type PhotoResult = z.infer<typeof PhotoResponse>;

// --- sort groceries ---------------------------------------------------------

export const SortedItem = z.object({
  name: z.string(),
  quantity: z.string().nullable(),
  location: z.enum(["fridge", "freezer", "pantry"]),
  shelf_life_days: z.number().int().nullable(),
});
export const SortResponse = z.object({ items: z.array(SortedItem) });
export type SortedItem = z.infer<typeof SortedItem>;

export const SortRequest = z.object({
  text: z.string().trim().min(1, "Paste your grocery list first.").max(4000, "Keep the list under 4,000 characters."),
});

// --- cook -------------------------------------------------------------------

export const MEAL_TYPES = ["any", "breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

const IsoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date.");

export const MealIdea = z.object({
  name: z.string(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  minutes: z.number().int(),
  method: z.string(),
  uses: z.array(z.string()),
});
export const CookResponse = z.object({ items: z.array(MealIdea) });
export type MealIdea = z.infer<typeof MealIdea>;

export const CookRequest = z.object({
  date: IsoDateString,
  meal: z.enum(MEAL_TYPES).default("any"),
});

// --- prep plan --------------------------------------------------------------

export const PrepComponent = z.object({
  name: z.string(),
  method: z.string(),
  per_portion: z.object({
    kcal: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  storage: z.string(),
  reheat: z.string(),
  uses: z.array(z.string()),
});
export const PrepPlanResponse = z.object({
  components: z.array(PrepComponent),
  assembly: z.array(z.string()),
});
export type PrepComponent = z.infer<typeof PrepComponent>;
export type PrepPlan = z.infer<typeof PrepPlanResponse>;

export const PrepPlanRequest = z.object({
  date: IsoDateString,
  servings: z.number().int().min(2).max(10),
});

// --- errors -----------------------------------------------------------------

export type AiErrorCode =
  | "unauthenticated"
  | "bad_request"
  | "not_configured"
  | "rate_limited"
  | "refused"
  | "truncated"
  | "bad_response"
  | "upstream_busy"
  | "upstream_auth"
  | "upstream_error"
  | "internal";

export type AiErrorBody = { error: { code: AiErrorCode; message: string } };
