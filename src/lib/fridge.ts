"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  PantryItem,
  ShoppingListItem,
  StorageLocation,
} from "@/lib/supabase/database.types";

/**
 * Reads and writes for the Fridge tab. Same contract as the Today tab's data
 * layer: throw with the message Postgres actually gave, so the screen can say
 * what went wrong instead of silently doing nothing.
 */

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export type KitchenData = {
  pantry: PantryItem[];
  shopping: ShoppingListItem[];
};

export async function fetchKitchen(): Promise<KitchenData> {
  const sb = supabaseBrowser();
  const [pantry, shopping] = await Promise.all([
    sb.from("pantry_items").select("*").order("expires_on", { ascending: true, nullsFirst: false }),
    sb.from("shopping_list").select("*").eq("done", false).order("created_at", { ascending: true }),
  ]);

  fail("Could not load the kitchen", pantry.error);
  fail("Could not load the shopping list", shopping.error);

  return { pantry: pantry.data ?? [], shopping: shopping.data ?? [] };
}

export type NewPantryItem = {
  name: string;
  quantity: string | null;
  location: StorageLocation;
  expires_on: string | null;
};

export async function addPantryItems(
  householdId: string,
  userId: string,
  items: readonly NewPantryItem[],
): Promise<PantryItem[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("pantry_items")
    .insert(
      items.map((i) => ({
        household_id: householdId,
        name: i.name.trim(),
        quantity: i.quantity?.trim() || null,
        location: i.location,
        expires_on: i.expires_on,
        created_by: userId,
      })),
    )
    .select();
  fail("Could not add that to the kitchen", error);
  return data ?? [];
}

export async function updatePantryItem(
  id: string,
  patch: Partial<Pick<PantryItem, "name" | "quantity" | "location" | "expires_on">>,
): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb.from("pantry_items").update(patch).eq("id", id);
  fail("Could not update that item", error);
}

export async function deletePantryItem(id: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb.from("pantry_items").delete().eq("id", id);
  fail("Could not remove that item", error);
}

export async function addShoppingItem(
  householdId: string,
  userId: string,
  name: string,
  note: string | null,
): Promise<ShoppingListItem> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("shopping_list")
    .insert({
      household_id: householdId,
      name: name.trim(),
      note: note?.trim() || null,
      added_by: userId,
    })
    .select()
    .single();

  // The partial unique index means adding something already on the list comes
  // back as a constraint violation. That is not worth an error banner.
  if (error?.code === "23505") {
    throw new Error(`"${name.trim()}" is already on the list.`);
  }
  fail("Could not add that to the list", error);
  if (!data) throw new Error("Could not add that to the list.");
  return data;
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const sb = supabaseBrowser();
  const { error } = await sb.from("shopping_list").delete().eq("id", id);
  fail("Could not remove that from the list", error);
}

/**
 * Ticking something off after a shop: it leaves the list and arrives in the
 * kitchen in one transaction, so it can never be in both places or neither.
 */
export async function stockShoppingItem(
  id: string,
  quantity: string | null,
  location: StorageLocation,
  expiresOn: string | null,
): Promise<PantryItem> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.rpc("stock_shopping_item", {
    p_id: id,
    p_quantity: quantity,
    p_location: location,
    p_expires_on: expiresOn,
  });
  fail("Could not put that away", error);
  if (!data) throw new Error("Could not put that away.");
  return data;
}

/** Moves something you have run out of from the kitchen onto the list. */
export async function moveToShoppingList(
  item: PantryItem,
  userId: string,
): Promise<void> {
  const sb = supabaseBrowser();
  const { error: insertError } = await sb.from("shopping_list").insert({
    household_id: item.household_id,
    name: item.name,
    added_by: userId,
  });
  // Already on the list is fine here — the point is to end up with the item
  // listed and out of the kitchen.
  if (insertError && insertError.code !== "23505") {
    fail("Could not add that to the list", insertError);
  }
  await deletePantryItem(item.id);
}
