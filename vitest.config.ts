import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Pick up TEST_DATABASE_URL from .env.local so `npm test` works without
// having to prefix the command with the connection string every time.
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // The RLS suite provisions a database; give it room on a cold start.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Vitest isolates files in worker threads by default; the RLS suite owns a
    // named database, so keep suites from racing each other over it.
    fileParallelism: false,
  },
});
