import type { Reporter, TestModule } from "vitest/node";

/**
 * Vitest swallows console output from a file whose tests all skipped, so the
 * warning inside rls.test.ts never reaches the terminal and "1 skipped" looks
 * like a clean run. This reporter prints from the main process instead, after
 * the summary, where it can't be missed.
 */
export default class SkipBanner implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    const rls = testModules.find((m) => m.moduleId.endsWith("tests/rls.test.ts"));
    if (!rls || rls.state() !== "skipped") return;

    const bar = "=".repeat(72);
    process.stderr.write(
      `\n${bar}\n` +
        " RLS POLICY TESTS DID NOT RUN — no Postgres was reachable.\n" +
        " A skipped run is not a passing run. Set TEST_DATABASE_URL and rerun\n" +
        " (README > Running the tests).\n" +
        `${bar}\n\n`,
    );
  }
}
