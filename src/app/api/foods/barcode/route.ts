import { requireUser, lookupBarcode } from "@/lib/fooddb-server";

/** GET /api/foods/barcode?code=… → the product per serving, or { food: null } if no database has it. */
export async function GET(request: Request): Promise<Response> {
  if (!(await requireUser())) {
    return Response.json({ error: { code: "unauthenticated", message: "You're signed out." } }, { status: 401 });
  }
  const code = new URL(request.url).searchParams.get("code")?.replace(/\D/g, "") ?? "";
  if (code.length < 6 || code.length > 14) {
    return Response.json({ error: { code: "bad_request", message: "That doesn't look like a barcode number." } }, { status: 400 });
  }
  const food = await lookupBarcode(code);
  return Response.json({ food }, { headers: { "Cache-Control": "private, max-age=86400" } });
}
