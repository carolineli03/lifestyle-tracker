import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ADMIN_URL,
  adminClient,
  createUser,
  databaseAvailable,
  dropTestDatabase,
  provisionTestDatabase,
  userClient,
} from "./support/db.js";

/**
 * These tests are the reason the household/private split is trustworthy.
 *
 * The cast:
 *   alice   — primary user, owns the household
 *   bob     — alice's partner, joins her household with the code
 *   carol   — a stranger with her own household
 *
 * The two load-bearing assertions the spec asks for are marked below.
 */

const DB_NAME = "lifestyle_tracker_rls_test";

/**
 * Probed at module scope, not in beforeAll: Vitest decides which suites to
 * collect before any hook runs, so the availability flag has to exist first.
 * Otherwise `runIf` reads a stale `false` and the whole suite silently skips.
 */
const available = await databaseAvailable();

let url = "";
let admin: Client;
let alice: Client;
let bob: Client;
let carol: Client;
let aliceId = "";
let bobId = "";
let carolId = "";
let householdId = "";
let joinCode = "";

beforeAll(async () => {
  if (!available) return;

  url = await provisionTestDatabase(DB_NAME);
  admin = await adminClient(url);

  aliceId = await createUser(admin, "alice@example.test");
  bobId = await createUser(admin, "bob@example.test");
  carolId = await createUser(admin, "carol@example.test");

  alice = await userClient(url, aliceId);
  bob = await userClient(url, bobId);
  carol = await userClient(url, carolId);

  const created = await alice.query<{ id: string; join_code: string }>(
    "select * from public.create_household($1)",
    ["Our kitchen"],
  );
  const household = created.rows[0];
  if (!household) throw new Error("create_household returned nothing");
  householdId = household.id;
  joinCode = household.join_code;

  await bob.query("select * from public.join_household($1)", [joinCode]);
  await carol.query("select * from public.create_household($1)", ["Carol's kitchen"]);
}, 60_000);

afterAll(async () => {
  if (!available) return;
  await Promise.all(
    [admin, alice, bob, carol].map((c) => c?.end().catch(() => undefined)),
  );
  await dropTestDatabase(DB_NAME);
});

if (!available) {
  console.warn(
    `\n[rls] No Postgres reachable at ${ADMIN_URL}.` +
      "\n[rls] Set TEST_DATABASE_URL or start one (see README > Running the tests)." +
      "\n[rls] The RLS policy tests were SKIPPED. They did not pass — they did not run.\n",
  );
}

describe("RLS policies", () => {
  describe.runIf(available)("household setup", () => {
    it("puts both partners in one household", async () => {
      const { rows } = await alice.query<{ count: string }>(
        "select count(*)::text as count from public.household_members where household_id = $1",
        [householdId],
      );
      expect(rows[0]?.count).toBe("2");
    });

    it("issues an unambiguous join code", () => {
      expect(joinCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    });

    it("refuses a join code that does not exist", async () => {
      await expect(
        bob.query("select * from public.join_household($1)", ["ZZZZZZ"]),
      ).rejects.toThrow(/does not match any household/i);
    });
  });

  describe.runIf(available)("the shared kitchen", () => {
    it("REQUIRED: a second user in the household can read pantry_items", async () => {
      await alice.query(
        `insert into public.pantry_items (household_id, name, quantity, location, expires_on)
         values ($1, 'Chicken thighs', '2 lb', 'fridge', current_date + 3)`,
        [householdId],
      );

      const { rows } = await bob.query<{ name: string }>(
        "select name from public.pantry_items",
      );
      expect(rows.map((r) => r.name)).toContain("Chicken thighs");
    });

    it("lets the second user add to the kitchen too", async () => {
      await bob.query(
        `insert into public.pantry_items (household_id, name, quantity, location)
         values ($1, 'Sourdough', '1 loaf', 'pantry')`,
        [householdId],
      );
      const { rows } = await alice.query("select name from public.pantry_items where name = 'Sourdough'");
      expect(rows).toHaveLength(1);
    });

    it("shares the food library across the household", async () => {
      await alice.query(
        `insert into public.foods (household_id, name, kcal, protein_g, carb_g, fat_g, times_logged)
         values ($1, 'Greek yogurt', 130, 22, 8, 0, 3)`,
        [householdId],
      );
      const { rows } = await bob.query("select name from public.foods");
      expect(rows).toHaveLength(1);
    });

    it("dedupes foods case-insensitively", async () => {
      await expect(
        bob.query(
          `insert into public.foods (household_id, name, kcal) values ($1, 'greek YOGURT', 130)`,
          [householdId],
        ),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it("hides the kitchen from someone in a different household", async () => {
      const { rows } = await carol.query("select name from public.pantry_items");
      expect(rows).toHaveLength(0);
    });

    it("stops an outsider writing into someone else's kitchen", async () => {
      await expect(
        carol.query(
          `insert into public.pantry_items (household_id, name) values ($1, 'Sabotage')`,
          [householdId],
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  describe.runIf(available)("private logs", () => {
    it("REQUIRED: a second user in the household cannot read the first user's weigh_ins", async () => {
      await alice.query(
        "insert into public.weigh_ins (user_id, logged_on, weight_lb) values ($1, current_date, 168.4)",
        [aliceId],
      );

      // Alice sees her own weigh-in...
      const mine = await alice.query("select weight_lb from public.weigh_ins");
      expect(mine.rows).toHaveLength(1);

      // ...and Bob, who shares her kitchen, sees nothing at all.
      const partner = await bob.query("select weight_lb from public.weigh_ins");
      expect(partner.rows).toHaveLength(0);

      // Not even when he asks for her row by id.
      const targeted = await bob.query("select weight_lb from public.weigh_ins where user_id = $1", [
        aliceId,
      ]);
      expect(targeted.rows).toHaveLength(0);
    });

    it("keeps food entries private", async () => {
      await alice.query(
        `insert into public.entries (user_id, logged_on, name, kcal, protein_g, carb_g, fat_g)
         values ($1, current_date, 'Scrambled eggs', 220, 14, 2, 16)`,
        [aliceId],
      );
      const { rows } = await bob.query("select name from public.entries");
      expect(rows).toHaveLength(0);
    });

    it("keeps movement private", async () => {
      await alice.query(
        "insert into public.movement (user_id, logged_on, kind, minutes) values ($1, current_date, 'Walk', 30)",
        [aliceId],
      );
      const { rows } = await bob.query("select kind from public.movement");
      expect(rows).toHaveLength(0);
    });

    it("keeps profiles private", async () => {
      await alice.query(
        "update public.profiles set kcal_target = 1850 where user_id = $1",
        [aliceId],
      );
      const { rows } = await bob.query("select kcal_target from public.profiles");
      // Bob sees exactly one profile: his own, with no target set.
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ kcal_target: null });
    });

    it("refuses to write a log row on someone else's behalf", async () => {
      await expect(
        bob.query(
          "insert into public.weigh_ins (user_id, logged_on, weight_lb) values ($1, current_date - 1, 150)",
          [aliceId],
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("refuses to update someone else's row", async () => {
      const { rowCount } = await bob.query(
        "update public.weigh_ins set weight_lb = 999 where user_id = $1",
        [aliceId],
      );
      expect(rowCount).toBe(0);
    });

    it("keeps AI usage private", async () => {
      await alice.query(
        `insert into public.ai_usage (user_id, route, model, input_tokens, output_tokens)
         values ($1, '/api/estimate', 'claude-sonnet-4-6', 400, 120)`,
        [aliceId],
      );
      const { rows } = await bob.query("select route from public.ai_usage");
      expect(rows).toHaveLength(0);
    });
  });

  describe.runIf(available)("log_entry", () => {
    it("writes the entry and remembers the food in one go", async () => {
      await alice.query("select * from public.log_entry($1, $2, $3, $4, $5, $6)", [
        "Oat porridge",
        320,
        11,
        54,
        6,
        "2026-09-13",
      ]);

      const entry = await alice.query<{ name: string; kcal: number; food_id: string | null }>(
        "select name, kcal, food_id from public.entries where name = 'Oat porridge'",
      );
      expect(entry.rows[0]?.kcal).toBe(320);
      expect(entry.rows[0]?.food_id).not.toBeNull();

      const food = await alice.query<{ times_logged: number }>(
        "select times_logged from public.foods where name = 'Oat porridge'",
      );
      expect(food.rows[0]?.times_logged).toBe(1);
    });

    it("increments the counter instead of duplicating the food", async () => {
      await alice.query("select * from public.log_entry($1, $2, $3, $4, $5, $6)", [
        "oat PORRIDGE", // different casing on purpose
        320,
        11,
        54,
        6,
        "2026-09-13",
      ]);

      const { rows } = await alice.query<{ count: string; times_logged: number }>(
        `select count(*)::text as count, max(times_logged) as times_logged
         from public.foods where lower(name) = 'oat porridge'`,
      );
      expect(rows[0]?.count).toBe("1");
      expect(rows[0]?.times_logged).toBe(2);
    });

    it("leaves the library's canonical macros alone when a portion is adjusted", async () => {
      // Half a portion today should not rewrite what a full portion is.
      await alice.query("select * from public.log_entry($1, $2, $3, $4, $5, $6)", [
        "Oat porridge",
        160,
        5.5,
        27,
        3,
        "2026-09-13",
      ]);

      const food = await alice.query<{ kcal: number }>(
        "select kcal from public.foods where lower(name) = 'oat porridge'",
      );
      expect(food.rows[0]?.kcal).toBe(320);

      // Three entries by now: the two full portions logged above (one of them
      // under different casing) and this half one. Each kept its own numbers.
      const entries = await alice.query<{ kcal: number }>(
        "select kcal from public.entries where lower(name) = 'oat porridge' order by kcal",
      );
      expect(entries.rows.map((r) => r.kcal)).toEqual([160, 320, 320]);
    });

    it("can log without remembering the food", async () => {
      await alice.query("select * from public.log_entry($1, $2, $3, $4, $5, $6, $7)", [
        "Slice of birthday cake",
        400,
        4,
        55,
        18,
        "2026-09-13",
        false,
      ]);

      const food = await alice.query("select 1 from public.foods where name = 'Slice of birthday cake'");
      expect(food.rows).toHaveLength(0);

      const entry = await alice.query("select 1 from public.entries where name = 'Slice of birthday cake'");
      expect(entry.rows).toHaveLength(1);
    });

    it("shares the remembered food with the household but not the entry", async () => {
      const food = await bob.query("select name from public.foods where lower(name) = 'oat porridge'");
      expect(food.rows).toHaveLength(1);

      const entry = await bob.query("select name from public.entries where lower(name) = 'oat porridge'");
      expect(entry.rows).toHaveLength(0);
    });

    it("refuses a nameless entry", async () => {
      await expect(
        alice.query("select * from public.log_entry($1, $2, $3, $4, $5, $6)", ["   ", 100, 0, 0, 0, "2026-09-13"]),
      ).rejects.toThrow(/needs a name/i);
    });

    it("files the entry under the user who called it", async () => {
      await bob.query("select * from public.log_entry($1, $2, $3, $4, $5, $6)", [
        "Tuna salad",
        280,
        30,
        4,
        15,
        "2026-09-13",
      ]);
      const mine = await bob.query("select name from public.entries");
      expect(mine.rows.map((r) => r.name)).toContain("Tuna salad");

      const hers = await alice.query("select name from public.entries where name = 'Tuna salad'");
      expect(hers.rows).toHaveLength(0);
    });
  });

  describe.runIf(available)("the shopping list", () => {
    it("is shared: either person can add, both can see", async () => {
      await alice.query(
        "insert into public.shopping_list (household_id, name, added_by) values ($1, 'Tahini', $2)",
        [householdId, aliceId],
      );
      const seen = await bob.query("select name from public.shopping_list");
      expect(seen.rows.map((r) => r.name)).toContain("Tahini");
    });

    it("refuses a duplicate of something already outstanding", async () => {
      await expect(
        bob.query("insert into public.shopping_list (household_id, name) values ($1, 'tahini')", [
          householdId,
        ]),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it("allows the same name again once the old one is gone", async () => {
      await admin.query("update public.shopping_list set done = true where name = 'Tahini'");
      await bob.query("insert into public.shopping_list (household_id, name) values ($1, 'Tahini')", [
        householdId,
      ]);
      const { rows } = await bob.query("select count(*)::text as c from public.shopping_list where lower(name) = 'tahini'");
      expect(rows[0]?.c).toBe("2");
      // Put the fixture back to a single open row for the tests below.
      await admin.query("delete from public.shopping_list where done = true");
    });

    it("is invisible to another household", async () => {
      const { rows } = await carol.query("select name from public.shopping_list");
      expect(rows).toHaveLength(0);
    });

    it("cannot be written into someone else's household", async () => {
      await expect(
        carol.query("insert into public.shopping_list (household_id, name) values ($1, 'Sabotage')", [
          householdId,
        ]),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  describe.runIf(available)("stock_shopping_item", () => {
    it("moves an item off the list and into the kitchen in one step", async () => {
      const listed = await bob.query<{ id: string }>(
        "select id from public.shopping_list where lower(name) = 'tahini'",
      );
      const id = listed.rows[0]?.id;
      expect(id).toBeDefined();

      const stocked = await bob.query<{ name: string; location: string; quantity: string | null }>(
        "select name, location, quantity from public.stock_shopping_item($1, $2, $3, $4)",
        [id, "1 jar", "pantry", "2027-01-01"],
      );
      expect(stocked.rows[0]).toMatchObject({ name: "Tahini", location: "pantry", quantity: "1 jar" });

      const stillListed = await bob.query("select 1 from public.shopping_list where id = $1", [id]);
      expect(stillListed.rows).toHaveLength(0);

      // And Alice, who shares the kitchen, sees it arrive.
      const hers = await alice.query("select name from public.pantry_items where name = 'Tahini'");
      expect(hers.rows).toHaveLength(1);
    });

    it("refuses an item that is no longer on the list", async () => {
      await expect(
        bob.query("select * from public.stock_shopping_item($1)", [
          "00000000-0000-0000-0000-000000000000",
        ]),
      ).rejects.toThrow(/no longer on the list/i);
    });

    it("will not let an outsider stock another household's item", async () => {
      await alice.query(
        "insert into public.shopping_list (household_id, name) values ($1, 'Miso')",
        [householdId],
      );
      const { rows } = await alice.query<{ id: string }>(
        "select id from public.shopping_list where name = 'Miso'",
      );
      // Carol cannot even see the row, so the function reports it as missing
      // rather than leaking that it exists.
      await expect(
        carol.query("select * from public.stock_shopping_item($1)", [rows[0]?.id]),
      ).rejects.toThrow(/no longer on the list/i);
    });
  });

  describe.runIf(available)("recipes and the meal plan", () => {
    let chiliId = "";
    let cookId = "";

    it("shares recipes within the household", async () => {
      const { rows } = await alice.query<{ id: string }>(
        `insert into public.recipes (household_id, name, servings, ingredients, source)
         values ($1, 'Chili', 4, array['2 lb beef', '1 onion'], 'manual') returning id`,
        [householdId],
      );
      chiliId = rows[0]?.id ?? "";
      const seen = await bob.query<{ name: string }>("select name from public.recipes");
      expect(seen.rows.map((r) => r.name)).toContain("Chili");
    });

    it("refuses the same recipe name twice, ignoring case", async () => {
      await expect(
        bob.query("insert into public.recipes (household_id, name) values ($1, 'CHILI ')", [householdId]),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it("lets the partner plan a cook and leftovers from the shared recipe", async () => {
      const cooked = await bob.query<{ id: string }>(
        `insert into public.meal_plan (household_id, planned_on, meal, recipe_id, eaters)
         values ($1, current_date, 'dinner', $2, 2) returning id`,
        [householdId, chiliId],
      );
      cookId = cooked.rows[0]?.id ?? "";
      await alice.query(
        `insert into public.meal_plan (household_id, planned_on, meal, recipe_id, eaters, leftovers_from)
         values ($1, current_date + 1, 'lunch', $2, 2, $3)`,
        [householdId, chiliId, cookId],
      );
      const { rows } = await alice.query("select id from public.meal_plan");
      expect(rows).toHaveLength(2);
    });

    it("refuses leftovers more than four days after cooking", async () => {
      await expect(
        alice.query(
          `insert into public.meal_plan (household_id, planned_on, meal, recipe_id, leftovers_from)
           values ($1, current_date + 5, 'dinner', $2, $3)`,
          [householdId, chiliId, cookId],
        ),
      ).rejects.toThrow(/within four days/i);
    });

    it("refuses leftovers before the meal was cooked", async () => {
      await expect(
        alice.query(
          `insert into public.meal_plan (household_id, planned_on, meal, recipe_id, leftovers_from)
           values ($1, current_date - 1, 'dinner', $2, $3)`,
          [householdId, chiliId, cookId],
        ),
      ).rejects.toThrow(/within four days/i);
    });

    it("refuses two plans for the same meal slot", async () => {
      await expect(
        bob.query(
          `insert into public.meal_plan (household_id, planned_on, meal, recipe_id)
           values ($1, current_date, 'dinner', $2)`,
          [householdId, chiliId],
        ),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it("hides recipes and plans from another household", async () => {
      expect((await carol.query("select id from public.recipes")).rows).toHaveLength(0);
      expect((await carol.query("select id from public.meal_plan")).rows).toHaveLength(0);
    });

    it("cannot plan a meal from another kitchen's recipe", async () => {
      const carolHousehold = await carol.query<{ id: string }>("select public.current_household_id() as id");
      const theirs = await carol.query<{ id: string }>(
        "insert into public.recipes (household_id, name) values ($1, 'Carol soup') returning id",
        [carolHousehold.rows[0]?.id],
      );
      await expect(
        alice.query(
          `insert into public.meal_plan (household_id, planned_on, meal, recipe_id)
           values ($1, current_date + 2, 'dinner', $2)`,
          [householdId, theirs.rows[0]?.id],
        ),
      ).rejects.toThrow(/foreign key/i);
    });

    it("removes the leftovers when the cook is deleted", async () => {
      await bob.query("delete from public.meal_plan where id = $1", [cookId]);
      const { rows } = await alice.query("select id from public.meal_plan");
      expect(rows).toHaveLength(0);
    });
  });

  describe.runIf(available)("ai_calls_since", () => {
    it("gives any user the app-wide count, and nothing else", async () => {
      await alice.query("insert into public.ai_usage (user_id, route, model) values ($1, 'estimate', 'claude-sonnet-5')", [aliceId]);
      await carol.query("insert into public.ai_usage (user_id, route, model) values ($1, 'cook', 'claude-sonnet-5')", [carolId]);
      const { rows } = await bob.query<{ n: number }>("select public.ai_calls_since(now() - interval '1 day') as n");
      expect(rows[0]?.n).toBe(2);
      // …while the rows themselves stay private.
      expect((await bob.query("select id from public.ai_usage")).rows).toHaveLength(0);
    });
  });

  describe.runIf(available)("household membership", () => {
    it("lets partners see each other", async () => {
      const { rows } = await bob.query("select user_id from public.household_members");
      expect(rows).toHaveLength(2);
    });

    it("hides membership from outsiders", async () => {
      const { rows } = await carol.query(
        "select user_id from public.household_members where household_id = $1",
        [householdId],
      );
      expect(rows).toHaveLength(0);
    });

    it("does not let a client insert itself into a household directly", async () => {
      await expect(
        carol.query(
          "insert into public.household_members (household_id, user_id) values ($1, $2)",
          [householdId, carolId],
        ),
      ).rejects.toThrow(/row-level security|permission denied/i);
    });

    it("refuses to put someone in a second household", async () => {
      await expect(
        carol.query("select * from public.join_household($1)", [joinCode]),
      ).rejects.toThrow(/already in a household/i);
    });
  });
});
