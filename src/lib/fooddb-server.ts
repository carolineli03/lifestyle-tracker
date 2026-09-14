import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";
import { barcodeVariants, genericFirst, normaliseOff, normaliseUsda, type DbFood, type OffProduct, type UsdaFood } from "@/lib/fooddb";

/**
 * Server side of the food database: the outside calls happen here, not in the
 * browser. Open Food Facts asks for an identifying User-Agent (browsers can't
 * set one), and the USDA key stays off the client.
 */

const USER_AGENT = "LifestyleTracker/1.0 (personal meal-prep app)";
const TIMEOUT_MS = 8000;
const OFF_FIELDS = "code,product_name,brands,serving_size,serving_quantity,nutriments";

export async function requireUser(): Promise<boolean> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 86_400 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchUsda(query: string): Promise<DbFood[]> {
  const key = serverEnv.usdaApiKey ?? "DEMO_KEY";
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("dataType", "Foundation,SR Legacy,Branded");
  const body = (await getJson(url.toString())) as { foods?: UsdaFood[] };
  return genericFirst((body.foods ?? []).map(normaliseUsda).filter((f): f is DbFood => f !== null));
}

export async function searchOff(query: string): Promise<DbFood[]> {
  const url = new URL("https://search.openfoodfacts.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "10");
  url.searchParams.set("fields", OFF_FIELDS);
  const body = (await getJson(url.toString())) as { hits?: OffProduct[] };
  return (body.hits ?? []).map(normaliseOff).filter((f): f is DbFood => f !== null);
}

export async function lookupBarcode(code: string): Promise<DbFood | null> {
  for (const variant of barcodeVariants(code)) {
    try {
      const body = (await getJson(
        `https://world.openfoodfacts.org/api/v2/product/${variant}.json?fields=${OFF_FIELDS}`,
      )) as { status?: number; product?: OffProduct };
      if (body.status === 1 && body.product) {
        const food = normaliseOff({ ...body.product, code: body.product.code ?? variant });
        if (food) return food;
      }
    } catch {
      // Try the next variant, then USDA.
    }
  }
  // USDA branded foods are searchable by UPC.
  try {
    const hits = await searchUsda(code.replace(/\D/g, ""));
    return hits.find((f) => f.barcode && barcodeVariants(code).includes(f.barcode)) ?? null;
  } catch {
    return null;
  }
}
