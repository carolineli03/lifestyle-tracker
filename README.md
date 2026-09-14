# Lifestyle Tracker

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
| AI | Anthropic API (`claude-sonnet-5`, structured outputs) | Server-side route handlers only |
| Tests | Vitest | Target maths and RLS policies |

No analytics, no third-party scripts. Fonts are self-hosted by `next/font`, so
the browser never makes a request to Google.

---

## Getting started

### First-time setup checklist

The short version, for a brand-new Supabase project and Vercel account. The
numbered sections below explain each step.

1. **Supabase → New project.** Save the database password somewhere; `db push`
   asks for it.
2. **Keys.** Project Settings → API. Copy the *Project URL* and the *anon* (or
   *publishable*) key into `.env.local`. Never use the `service_role`/secret key.
3. **Auth redirects.** Authentication → URL Configuration:
   - Site URL: `http://localhost:3000` (change it to the Vercel origin once
     deployed)
   - Redirect URLs: `http://localhost:3000/auth/callback` and
     `https://<your-vercel-domain>/auth/callback`
4. **Schema.** Without installing the CLI globally:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>   # <ref> is the subdomain of the Project URL
   npx supabase db push
   ```
5. **Run locally.** `npm run dev`, open <http://localhost:3000>, sign in by
   magic link.
6. **Vercel.** Import the GitHub repo, then add `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (the production
   origin) and `ANTHROPIC_API_KEY` (unprefixed, server-only) under Settings →
   Environment Variables. Redeploy.

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

There's no sign-in step. The first visit creates a guest account (see
[Guest accounts](#guest-accounts)). **Anonymous sign-ins must be enabled** in
Supabase → Authentication → Sign In / Providers, or `/start` shows an error
with a link to email sign-in instead.

---

## Guest accounts

Opening the app without a session sends you to `/start`, which calls
`supabase.auth.signInAnonymously()` in the browser and carries on. A guest is
a real Supabase user with a real `auth.uid()`, so every RLS policy, the
profile trigger and the household RPCs work exactly as they do for an email
account. Nothing in the schema knows the difference.

Two consequences worth remembering:

- **A guest account lives in that browser.** Clearing site data, using a
  private window or switching phones starts a new, empty account. The Fridge
  tab offers **Keep my data**, which adds an email to the same account
  (`updateUser({ email })`) once the link is confirmed. Same user id, same rows.
- **Guests can't sign out.** Signing out would leave their data unreachable,
  so the button only appears for accounts with an email.

It happens in the browser rather than in the proxy on purpose: link previews
and crawlers that don't run JavaScript never create accounts. Supabase also
rate-limits anonymous sign-ins per IP.

Email sign-in at `/login` still works.

---

## Sharing a kitchen

The first person to open the app picks **Start a kitchen** and gets a six-character
join code (shown on the Fridge tab). The second person opens the app on their phone, picks **Join
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

## What's in the kitchen, and what isn't

The Fridge tab holds two lists that deliberately live in separate tables.

**`pantry_items`** is what you own. Every row has a location and, optionally, a
use-by date. The inventory is grouped by location with the soonest-expiring
first and undated items last, and each item carries a badge: red at two days
or less (including already past), amber at five or less, neutral otherwise,
and a plain date once it is more than a month out. Anything inside five days
also surfaces in a "use these up" strip at the top, which is what phase 5's
cook suggestions will read from.

**`shopping_list`** is what you don't. A thing you haven't bought has no
location and no shelf life, which is why it isn't a `needed` flag on
`pantry_items` — that would put a filter on every inventory query and leave two
meaningless columns on half the rows.

The two are joined by two moves:

- **Used up → shopping list.** An item leaves the kitchen and lands on the
  list.
- **Tick off → into the kitchen.** After a shop, ticking an item opens a small
  put-away step (quantity, location, and a shelf-life shortcut) and the
  `stock_shopping_item` RPC does both writes in one transaction. Without that,
  a failure halfway leaves groceries both still on the list and already in the
  fridge.

Outstanding list items are deduped case-insensitively by a *partial* unique
index (`where done = false`), so adding milk twice in one week is refused but
buying milk again next month is fine.

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
- **Expiry maths** (`tests/expiry.test.ts`) — badge thresholds, sort order,
  and day counting across month ends and daylight-saving shifts.
- **Target maths** (`tests/targets.test.ts`, `tests/trends.test.ts`) —
  Mifflin-St Jeor against hand-worked values, the `max(1,200, BMR)` floor and
  the real weekly rate it produces, the protein cap, the goal-pace line and the
  seven-day movement window.
- **AI plumbing** (`tests/ai-*.test.ts`) — tolerant JSON parsing, what the
  prompts contain and in what order, cost maths, and the shared runner against
  a fake model: refusal, truncation, unusable replies, the hourly limit, a
  missing or rejected key. No test calls the real API.

When the RLS suite skips, a banner prints after the summary
(`tests/support/skip-banner.ts`). Vitest hides console output from an
all-skipped file, so without it "1 skipped" looks like a clean run.

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

## Logging from a photo

Today → Log food → **Photo**. **Take photo** opens the rear camera on a phone;
**Choose photo** picks one from the library.

- The browser shrinks the photo to 1568px on the long edge as JPEG before
  uploading (`src/lib/image.ts`). A label stays legible at that size, and the
  upload stays well under Vercel's 4.5MB request limit.
- With a Nutrition Facts panel, the per-serving numbers and printed serving
  size are copied exactly. Without one, each visible food is estimated and
  labelled as an estimate.
- Results land as drafts with per-serving numbers and servings set to 1. Set
  how many servings you had, check the numbers, then confirm.
- **The photo is never stored.** It goes to the model and nowhere else. Only
  token counts reach `ai_usage`.

---

## Planning the week

Cook → **Plan** and **Recipes**.

**Recipes** are shared within the household. You can add one by typing it
in, by saving any Cook idea or Sunday prep component, or by pasting recipe
text to import it. An import fills the form for review and doesn't save on its
own.

**Plan** is a Monday-start week. Each meal slot on a day is one of:

- **Cooking:** a recipe and how many people are eating. **Make extra for…**
  lists the free meals in the next four days; tapping one adds leftovers for
  it.
- **Leftovers:** points at the cooked meal it comes from.

Each cooked card shows **Make N portions**: the people at that meal plus
everyone eating its leftovers. It also says how that compares to what the
recipe makes ("1.5× the recipe"). The numbers are computed in
`src/lib/planner.ts`, not stored, so changing Tuesday's headcount updates
Sunday's straight away.

The database enforces the rules as well as the UI (`supabase/migrations/20260913160000_meal_planner.sql`):

- Leftovers must come from a cooked meal and use the same recipe.
- They must fall later, within four days.
- One plan per day and meal.
- A plan can't point at another household's recipe.
- Deleting a recipe or a cook removes what depends on it.

---

## The AI features

Six route handlers under `src/app/api/`, all on `claude-sonnet-5`:

| Route | Used by | What it returns |
|---|---|---|
| `POST /api/estimate` | Today → Describe it | Items with kcal / protein / carbs / fat, as editable drafts |
| `POST /api/photo` | Today → Photo | Per-serving numbers from a label, or estimates from a plate |
| `POST /api/import-recipe` | Cook → Recipes | Name, servings, ingredient lines and method, filled into the form |
| `POST /api/sort-groceries` | Fridge → Bulk add | Items with a location and shelf life, as an editable list |
| `POST /api/cook` | Cook → three ideas | Three meals from the kitchen, soonest use-by first |
| `POST /api/prep-plan` | Cook → Sunday prep | 2–3 batch components for N lunches |

They share one runner, `src/lib/ai/core.ts`. Rules worth remembering:

- **Nothing is written from a model reply without you confirming it**, except
  "Log this" on a cook idea, which is itself the confirmation.
- **Replies are validated, never trusted.** The request carries a JSON schema
  (structured outputs) built from the Zod schemas in `src/lib/ai/schemas.ts`.
  The reply is still stripped of code fences and checked against Zod. If it
  doesn't fit, the route returns an error. It never substitutes numbers.
- **Cook and prep plan read the kitchen on the server** through your own RLS.
  The browser only sends its local date.
- **Rate limits:** 20 calls per person per rolling hour
  (`AI_CALLS_PER_HOUR`), and 150 calls per 24 hours across the whole app
  (`AI_CALLS_PER_DAY_ALL`). Guest accounts are free to create, so the app-wide
  cap is the one that actually bounds the bill. It reads a bare count from the
  SECURITY DEFINER `ai_calls_since()`, which exposes no rows.
- **Cost:** every call, including failures, logs its tokens to `ai_usage`.
  Progress shows "AI this month" from those rows at list prices. For the
  household total, run this in the Supabase SQL editor (it bypasses RLS):
  ```sql
  select date_trunc('month', created_at) as month, count(*) as calls,
         sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens,
         round(sum(input_tokens) * 2.0 / 1e6 + sum(output_tokens) * 10.0 / 1e6, 2) as usd
  from ai_usage group by 1 order by 1 desc;
  ```
- **The key stays on the server.** `ANTHROPIC_API_KEY` is read in exactly one
  place, `src/lib/env.server.ts`, behind `import "server-only"`. If a client
  component imports that file, the build fails.

Without a key the app works fully by hand. The AI buttons say "AI features
aren't set up yet" instead of spinning.

---

## Installing it and offline use

It's a PWA. On iPhone, open it in Safari → Share → **Add to Home Screen**. On
Android, Chrome offers **Install app**.

`public/sw.js` is a small hand-written service worker, registered only in
production builds (`src/components/ServiceWorker.tsx`):

- `/_next/static` and `/icons` are cached permanently (cache-first).
- Page loads and Supabase table reads are network-first. When there's no
  signal, you get the last copy loaded, and a banner says you're offline.
- Writes, `/api/*`, auth routes and Supabase auth are never cached or
  replayed. A save attempted offline fails and says so.
- **Signing out deletes the page and data caches.**
- Nothing is precached, so a tab works offline once you've opened it online
  at least once.

To change the caching strategy, bump `VERSION` at the top of `sw.js`. The next
visit drops the old caches. The icons come from `scripts/make-icons.mjs`;
edit the SVG there and run `node scripts/make-icons.mjs`.

To test it locally, use a production build (`npm run build && npm start`). In
`next dev` the worker is deliberately not registered.

---

## Deploying

Order matters: **database first, then the app.**

1. **Migrations to production:** `npx supabase link --project-ref <ref>`, then
   `npx supabase db push`.
2. **Get the code on `main`** in GitHub.
3. **Vercel:** <https://vercel.com/new> → import `carolineli03/lifestyle-tracker`.
   The framework preset is detected as Next.js; leave the build settings alone.
4. **Environment variables** (Vercel → Settings → Environment Variables,
   Production and Preview):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
   | `NEXT_PUBLIC_SITE_URL` | The production origin, e.g. `https://lifestyle-tracker.vercel.app` (no trailing slash) |
   | `ANTHROPIC_API_KEY` | Your Anthropic key, **unprefixed** |

   `NEXT_PUBLIC_*` values are baked in at build time. If you change one,
   redeploy.
5. **Supabase → Authentication → URL Configuration:** set the Site URL to the
   production origin, and add `https://<prod-domain>/auth/callback` to the
   redirect URLs. Keep the localhost entries for local development.
6. **Deploy**, then sign in on your phone and Add to Home Screen.

Nothing in the build touches the database, so a deploy is never blocked by an
unrun migration. The app will fail at runtime if the schema is behind, which is
why migrations come first.

---

## Project layout

```
src/
  app/
    (app)/            the four tabs, behind the auth + household gate
      today/ fridge/ cook/ progress/
    api/              the four AI route handlers
    manifest.ts       PWA manifest (/manifest.webmanifest)
    auth/             magic-link callback, sign-out, error page
    login/            email entry
    onboarding/       start or join a household
    globals.css       design tokens and base styles
  components/         shared UI, no component library
  lib/
    ai/               schemas, prompts, the shared runner, browser client
    env.ts            public environment access with readable failures
    env.server.ts     ANTHROPIC_API_KEY — server-only
    household.ts      the one query every authenticated page needs
    supabase/         browser, server and proxy clients + hand-kept types
  proxy.ts            session refresh and the signed-in redirect
public/sw.js          service worker (offline reads)
public/icons/         PWA icons, generated by scripts/make-icons.mjs
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
`lifestyle-tracker-theme` to `localStorage` and is applied before first paint by a small
inline script, so there is no flash of the wrong theme.

---

## Build status

| Phase | Scope | State |
|---|---|---|
| 1 | Scaffold, migrations, RLS, auth, tab shell, design tokens | **Done** |
| 2 | Today — food entry, food library, movement, weigh-ins | **Done** |
| 3 | Fridge — inventory, shopping list, expiry badges, filters | **Done** |
| 4 | Progress — chart, stats, target calculator | Built; signed-in browser check pending |
| 5 | AI routes — estimate, sort groceries, cook, prep plan | Built; untested against the real API (no Anthropic key yet) |
| 6 | PWA packaging, offline reads, Vercel deploy | Deployed at lifestyle-tracker-one.vercel.app |
| 7 | Guest accounts, photo logging, weekly meal planner, app-wide AI cap | Built; live check pending |
