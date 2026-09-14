import "server-only";

/**
 * Server-only environment. The `server-only` import makes any client
 * component that reaches this file fail the build, which is the guarantee
 * that ANTHROPIC_API_KEY never lands in the browser bundle.
 */
export const serverEnv = {
  get anthropicApiKey(): string | undefined {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    return key ? key : undefined;
  },
  /** Optional. Without it the food search uses USDA's rate-limited DEMO_KEY. */
  get usdaApiKey(): string | undefined {
    const key = process.env.USDA_API_KEY?.trim();
    return key ? key : undefined;
  },
};
