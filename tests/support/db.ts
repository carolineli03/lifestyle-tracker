import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

/**
 * Where the RLS suite finds a Postgres to run against.
 *
 * Anything works: a `supabase start` stack, a throwaway container, or a bare
 * `initdb` cluster. The suite creates and drops its own database, so pointing
 * this at a development server is safe as long as the role can CREATE DATABASE.
 */
export const ADMIN_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function run(client: Client, sql: string): Promise<void> {
  await client.query(sql);
}

async function readSupportSql(name: string): Promise<string> {
  return readFile(path.join(here, name), "utf8");
}

/** True when a Postgres we are allowed to create databases on is reachable. */
export async function databaseAvailable(): Promise<boolean> {
  const client = new Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Build a throwaway database containing the Supabase shim plus every
 * migration in supabase/migrations, applied in filename order — the same
 * order the Supabase CLI applies them in.
 */
export async function provisionTestDatabase(name: string): Promise<string> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await run(admin, await readSupportSql("roles.sql"));
    await run(admin, `drop database if exists "${name}" with (force)`);
    await run(admin, `create database "${name}"`);
  } finally {
    await admin.end();
  }

  const url = withDatabase(ADMIN_URL, name);
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await run(db, await readSupportSql("supabase-shim.sql"));

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    if (files.length === 0) {
      throw new Error(`No migrations found in ${migrationsDir}`);
    }
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      try {
        await run(db, sql);
      } catch (cause) {
        throw new Error(`Migration ${file} failed: ${(cause as Error).message}`, { cause });
      }
    }

    await run(db, await readSupportSql("grants.sql"));
  } finally {
    await db.end();
  }
  return url;
}

export async function dropTestDatabase(name: string): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`drop database if exists "${name}" with (force)`);
  } finally {
    await admin.end();
  }
}

/** A superuser connection. Bypasses RLS — use it only for fixtures. */
export async function adminClient(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * A connection that behaves like a signed-in browser: the `authenticated`
 * role with a JWT subject claim, which is exactly what PostgREST hands a
 * request and exactly what auth.uid() reads.
 */
export async function userClient(url: string, userId: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await client.query("set role authenticated");
  return client;
}

export async function createUser(admin: Client, email: string): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [email],
  );
  const row = rows[0];
  if (!row) throw new Error(`Failed to create user ${email}`);
  return row.id;
}
