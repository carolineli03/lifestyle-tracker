import { mergeResults } from "@/lib/fooddb";
import { requireUser, searchOff, searchUsda } from "@/lib/fooddb-server";

/**
 * GET /api/foods/search?q=… → per-serving results from USDA and Open Food Facts.
 * One source failing still returns the other's results, with `partial: true`.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await requireUser())) {
    return Response.json({ error: { code: "unauthenticated", message: "You're signed out." } }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 80) {
    return Response.json({ error: { code: "bad_request", message: "Search needs 3 to 80 characters." } }, { status: 400 });
  }

  const [usda, off] = await Promise.allSettled([searchUsda(q), searchOff(q)]);
  const usdaFoods = usda.status === "fulfilled" ? usda.value : [];
  const offFoods = off.status === "fulfilled" ? off.value : [];
  if (usda.status === "rejected" && off.status === "rejected") {
    return Response.json(
      { error: { code: "upstream_error", message: "The food databases aren't answering right now. Add it by hand for now." } },
      { status: 502 },
    );
  }
  return Response.json(
    { foods: mergeResults(usdaFoods, offFoods), partial: usda.status === "rejected" || off.status === "rejected" },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
