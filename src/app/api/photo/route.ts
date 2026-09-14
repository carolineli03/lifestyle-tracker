import { handleAi } from "@/lib/ai/server";
import { PHOTO_PROMPT, PHOTO_SYSTEM } from "@/lib/ai/prompts";
import { PhotoRequest, PhotoResponse } from "@/lib/ai/schemas";

export const maxDuration = 60;

/**
 * A photo of a nutrition label (read exactly) or of a plate (estimated) →
 * per-serving macros for confirmation. The image goes to the model and
 * nowhere else: it isn't stored, logged, or written to ai_usage.
 */
export function POST(request: Request): Promise<Response> {
  return handleAi(request, PhotoRequest, async (body) => ({
    route: "photo",
    system: PHOTO_SYSTEM,
    user: [
      { type: "image", source: { type: "base64", media_type: body.mediaType, data: body.image } },
      { type: "text", text: PHOTO_PROMPT },
    ],
    schema: PhotoResponse,
    effort: "low",
  }));
}
