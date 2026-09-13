import { defineConfig } from "vitest/config";

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
