/**
 * Environment access with a readable failure mode.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when it is
 * referenced as a full static member expression, which is why these are
 * written out longhand rather than read from a loop.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in — see the README.`,
    );
  }
  return value;
}

export const publicEnv = {
  get supabaseUrl(): string {
    return required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return required(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
};

/**
 * Origin used to build the magic-link redirect. Falls back to Vercel's own
 * deployment URL so preview deployments work without extra configuration.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
