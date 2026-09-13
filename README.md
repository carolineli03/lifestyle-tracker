# Icebox

A meal-prep tracker for one household of two people. It keeps track of what's
in the kitchen, counts calories and macros, logs movement and weight, and
suggests meals from what's actually on hand.

The fridge and the food library are **shared** between both people. The food
log, movement log, weigh-ins and targets are **private to each person**. That
split is enforced by Postgres Row Level Security, not by application code, and
it is covered by tests — see [Running the tests](#running-the-tests).

## Stack

| Piece | Choice | Notes |
|---|---|---|
| Framework | Next.js 16, App Router, TypeScript strict | Deployed on Vercel |
| Database & auth | Supabase (Postgres, email magic link, RLS) | All authorisation lives in SQL |
| Styling | Tailwind CSS v4 | Design tokens as CSS variables, no component library |
| AI | Anthropic API (`claude-sonnet-4-6`) | Server-side route handlers only |
| Tests | Vitest | Target maths and RLS policies |

No analytics, no third-party scripts. Fonts are self-hosted by `next/font`, so
the browser never makes a request to Google.

---

## Getting started

### 1. Prerequisites

- Node.js 20 or newer
- A Supabase project (free tier is fine) — <https://supabase.com/dashboard>
- The Supabase CLI, for migrations: `npm install -g supabase`

### 2. Install and configure

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` from **Supabase dashboard → Project Settings → API**:

| Variable | Where it runs | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Anon key. Safe to ship — it does nothing without a session, and RLS guards every table |
| `NEXT_PUBLIC_SITE_URL` | browser + server | Origin used to build the magic-link redirect. `http://localhost:3000` in dev; your deployed origin in production, no trailing slash |
| `ANTHROPIC_API_KEY` | **server only** | Deliberately has no `NEXT_PUBLIC_` prefix, so Next.js will never inline it into the client bundle. Only `src/app/api/*` reads it |
| `TEST_DATABASE_URL` | tests only | Optional. See [Running the tests](#running-the-tests) |

`.env.local` is gitignored. `.env.example` is the committed template — keep it
in sync when you add a variable.

### 3. Apply the migrations

Link the CLI to your project once:

```bash
supabase link --project-ref <your-project-ref>   # the subdomain of your project URL
```

Then push the schema:

```bash
npm run db:push        # supabase db push — applies supabase/migrations to the linked project
```

To work against a local stack instead (needs Docker):

```bash
npm run db:start       # supabase start
npm run db:reset       # drops and re-applies every migration
```

After a schema change, regenerate the TypeScript types:

```bash
npm run db:types       # writes src/lib/supabase/database.types.ts
```

> **One gotcha worth remembering.** Every row shape in `database.types.ts` must
> be declared with `type`, never `interface`. supabase-js constrains each table
> to `Record<string, unknown>`, and TypeScript only grants implicit index
> signatures to type aliases. A single `interface` makes the whole schema fail
> the constraint, the client silently falls back to untyped, and `.rpc()` starts
> claiming its arguments should be `undefined` — an error that points nowhere
> near the actual cause.

### 4. Set the auth redirect URL

In **Supabase dashboard → Authentication → URL Configuration**, add:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`, plus your production
  equivalent once deployed.

Magic links that redirect to an unlisted URL are rejected, which shows up as a
generic "that link didn't work" page.

### 5. Run it

```bash
npm run dev            # http://localhost:3000
```

Sign in with your email. Supabase sends the link; in a local stack it is
captured by Inbucket at <http://localhost:54324> instead of being delivered.

---

## Sharing a kitchen

The first person to sign in picks **Start a kitchen** and gets a six-character
join code (shown on the Fridge tab). The second person signs in, picks **Join
with a code**, and enters it. From then on both accounts read and write the same
`pantry_items` and `foods` rows.

The code alphabet omits `I`, `L`, `O`, `0` and `1`, so a code read aloud across
a kitchen is not ambiguous.

Joining is handled by the `join_household` RPC rather than a direct insert: a
client cannot write itself into a household, because there is no INSERT policy
on `household_members` at all.

---

## How the food library builds itself

There is no food database to import and nothing to seed. Confirming an entry
calls the `log_entry` RPC, which writes the entry *and* upserts the food into
the household library in one transaction, deduping case-insensitively on name
and bumping `times_logged`. Search on the Today tab then orders by that count,
so the things you eat most float to the top on their own.

Two details worth knowing six months from now:

- **Adjusting a portion does not rewrite the library.** Log half a serving and
  the entry records half; the library row keeps the full portion it was
  created with. The library is the canonical serving, not the last thing you
  happened to eat.
- **The whole library is fetched once and filtered in memory.** It is a
  household's own list — tens to low hundreds of rows — so search-as-you-type
  lands on the keystroke instead of a debounced round trip.

---

## Running the tests

```bash
npm test
```

Two suites matter, because they are the two places where a bug does real damage:

- **RLS policies** (`tests/rls.test.ts`) — proves the sharing boundary. It
  stands up a throwaway database, applies the real migrations from
  `supabase/migrations` on top of a small Supabase shim (the `auth` schema,
  `auth.uid()`, and the three PostgREST roles), then drives it as three separate
  `authenticated` connections: you, your partner, and a stranger.
- **Day maths** (`tests/totals.test.ts`, `tests/date.test.ts`) — calories
  remaining, portion scaling, food ranking, and local calendar dates. The date
  tests exist because `logged_on` is a *local* day: build it from a UTC
  timestamp and dinner logged at 6pm lands on tomorrow.
- **Target maths** — Mifflin-St Jeor, the calorie floor, and the macro split.
  *(Arrives with the Progress tab in phase 4.)*

The RLS suite needs a Postgres it is allowed to `CREATE DATABASE` on. Set
`TEST_DATABASE_URL` in `.env.local` (Vitest reads it from there) or pass it
inline:

```bash
# Option A — the Supabase local stack (needs Docker)
npm run db:start
TEST_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54322/postgres" npm test

# Option B — any Postgres 15+ you already have
TEST_DATABASE_URL="postgres://postgres@127.0.0.1:5432/postgres" npm test
```

If no database is reachable the suite **skips and says so loudly**. A skipped
run is not a passing run — check the output before trusting it.

---

## Deploying

1. Push the repo to GitHub and import it at <https://vercel.com/new>.
2. Add the four environment variables above to the Vercel project
   (Settings → Environment Variables). Set `NEXT_PUBLIC_SITE_URL` to the
   production origin, e.g. `https://icebox.vercel.app`.
   `ANTHROPIC_API_KEY` goes in as a plain server variable — do not prefix it.
3. Add `https://<your-domain>/auth/callback` to the Supabase redirect URL list.
4. Apply migrations to the production project: `npm run db:push`.

Vercel builds with `npm run build`. There is no build step that needs the
database, so a deploy cannot be blocked by a migration that has not run yet —
but the app will error at runtime if the schema is behind, so push migrations
first.

---

## Project layout

```
src/
  app/
    (app)/            the four tabs, behind the auth + household gate
      today/ fridge/ cook/ progress/
    api/              AI route handlers (phase 5)
    auth/             magic-link callback, sign-out, error page
    login/            email entry
    onboarding/       start or join a household
    globals.css       design tokens and base styles
  components/         shared UI, no component library
  lib/
    env.ts            environment access with readable failures
    household.ts      the one query every authenticated page needs
    supabase/         browser, server and proxy clients + hand-kept types
  proxy.ts            session refresh and the signed-in redirect
supabase/migrations/  the schema, in order
tests/                Vitest suites and the database harness
```

`src/proxy.ts` is what older Next versions called `middleware.ts`; Next 16
renamed the convention.

---

## Design tokens

Defined once in `src/app/globals.css` and exposed to Tailwind via `@theme
inline`, so switching theme is a custom-property swap rather than a class
rebuild.

| Token | Light | Dark |
|---|---|---|
| `paper` (background) | `#F3F5F0` | `#0F1613` |
| `card` | `#FFFFFF` | `#18231E` |
| `ink` (text) | `#16211B` | `#E8EFE9` |
| `muted` | `#6E7F74` | `#93A69A` |
| `pine` (primary) | `#245C41` | `#63B287` |
| `marigold` (accent) | `#C98A00` | `#EBB43A` |
| `tomato` (warning) | `#C6402B` | `#EC7B65` |

Bricolage Grotesque for headings and figures, Inter for everything else, both
self-hosted. Tabular numerals are on by default — every number in this app gets
compared against another number. Radii: 14px cards, 10px inputs and buttons,
full pill on chips. `prefers-reduced-motion` is respected, keyboard focus is
always visible, and controls are at least 44px tall.

Theme follows the system setting; the manual override on the Fridge tab writes
`icebox-theme` to `localStorage` and is applied before first paint by a small
inline script, so there is no flash of the wrong theme.

---

## Build status

| Phase | Scope | State |
|---|---|---|
| 1 | Scaffold, migrations, RLS, auth, tab shell, design tokens | **Done** |
| 2 | Today — food entry, food library, movement, weigh-ins | **Done** |
| 3 | Fridge — manual add, expiry badges, filters | Not started |
| 4 | Progress — chart, stats, target calculator | Not started |
| 5 | AI routes — estimate, sort groceries, cook, prep plan | Not started |
| 6 | PWA packaging, offline reads, Vercel deploy | Not started |
