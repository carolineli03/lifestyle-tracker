import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Pick up TEST_DATABASE_URL from .env.local so `npm test` works without
// having to prefix the command with the connection string every time.
loadEnv({ path: ".env.local", quiet: true });

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Mirror the "@/*" path alias from tsconfig.json. Without it, any module
  // under test that imports a sibling by alias fails to resolve — and it fails
  // at import time, so the whole file reports as "no tests" rather than as a
  // failing assertion.
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
  test: {
    environment: "node",
    reporters: ["default", "./tests/support/skip-banner.ts"],
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // The RLS suite provisions a database; give it room on a cold start.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Vitest isolates files in worker threads by default; the RLS suite owns a
    // named database, so keep suites from racing each other over it.
    fileParallelism: false,
  },
});
