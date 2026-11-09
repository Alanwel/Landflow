# LandFlow

Land for sale across Uganda — residential, commercial, agricultural and
industrial plots. Built with **Next.js 16 (App Router)** and **Supabase**,
with Row Level Security as the security model.

Browse without an account. Sign in only to save a listing, post your own, or
answer enquiries.

**🟢 Live:** <https://landown.vercel.app> — real database, real enquiries.

---

## What it does

| | |
|---|---|
| **Browse** | Every listing is public. Filter by region, land type and price; search across title, description and location. |
| **Post land** | A signed-in owner posts a listing with title, description, price, location, region and type. |
| **Send an enquiry** | Any visitor can ask the seller a question from the listing page — no account needed. It lands in the seller's dashboard. |
| **Seller inbox** | The owner sees every enquiry on their land, and can mark it new / read / replied / closed. |
| **Buyer view** | Signed-in buyers see every enquiry they sent, and can withdraw one. |
| **Manage listings** | The owner can mark land active / sold / rented, or remove it. |
| **Photos** | The owner uploads up to any number of pictures. The first one is the cover image in the marketplace, and the listing page has a gallery. |
| **Admin panel** | `/admin` — every listing, every enquiry, every account. Edit anything, delete anything, suspend anyone. |

### The security model in one paragraph

`listings` are public to read while active and writable only by their owner.
`profiles` are private to their owner. `saved_listings` are private to their
owner. `listing_enquiries` can be written by anyone (a visitor must be able to
ask a question) but read only by the seller of that listing and the buyer who
sent it. `listing_photos` follow their listing. **The database enforces all of
this** — the app never decides who may see what. See `supabase/schema.sql` for
the policies and `supabase/rls-tests.sql` for the **56 assertions** that prove
they hold.

### The operator role

The operator is the person who runs the marketplace. They can see every
listing in every status and every enquiry whoever sent it, and they can take a
listing off the market without deleting it.

There is **no privileged database connection and no `if (admin)` check**
anywhere in the app. The operator panel reads the same tables through the same
Supabase client the browser uses. The only difference is that the operator's
SELECT policies are wider — so if the database said no, the page would simply
be empty. That is the property you want.

The role itself is one boolean on the profile, read through a SECURITY DEFINER
helper. It has to be `security definer`: a plain subquery would run as the
*caller*, and `profiles` is owner-only, so it could never see the flag.

## Stack

| Piece | Version | Why |
|---|---|---|
| Next.js | 16.4.x | App Router, Turbopack, `proxy.ts` (was `middleware.ts`) |
| React | 19.3 | |
| TypeScript | 5.x | strict mode on |
| Tailwind CSS | 4.x | CSS-first config, no `tailwind.config.js` |
| Supabase | `@supabase/ssr` 0.12.7, `supabase-js` 2.118.0 | Postgres + Auth + RLS |
| Node | 24 | Active LTS — Node 20 hit EOL 30 Apr 2026 |

---

## Quick start

```bash
npm install
cp .env.example .env.local     # add your Supabase URL + key
npm run dev
```

**No Supabase account?** The app will not show you fake listings. If the
database is unreachable or misconfigured you get a clear error, because a
silent fallback to sample data is how you end up debugging a ghost.

> This used to be the other way round: a failed query returned
> `DEMO_LISTINGS`, so a broken database looked like a perfectly working site.
> `lib/db.ts` now turns every failure into a real error.

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | for live data | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | for live data | the `anon` / publishable key |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | optional | shows a "Continue with Google" button |

> **Vercel:** env vars set only in `.env.local` will **not** reach production.
> Add them in Vercel → Project → Settings → Environment Variables.
>
> **`NEXT_PUBLIC_*` must be type "Config" (plaintext), not "Secret".**
> They are inlined into the browser bundle at build time, so an encrypted
> value arrives as `undefined` on the client. If you set them with the CLI:
>
> ```bash
> vercel env add NEXT_PUBLIC_SUPABASE_URL --value "$NEXT_PUBLIC_SUPABASE_URL" \
>   --environment production --type config --force --yes
> ```

---

## Database setup

Run `supabase/schema.sql` **once** in the Supabase Dashboard SQL Editor.

It creates three tables, enables RLS on all of them, adds the policies, and
creates the `seller_public` view.

### The security model

| Table | Read | Write |
|---|---|---|
| `listings` | **anyone** (active only) | owner only |
| `profiles` | **owner only** | owner only |
| `saved_listings` | owner only | owner only |

Public seller info leaves `profiles` through the `seller_public` **view**,
which exposes exactly three columns: `id`, `full_name`, `avatar_url`.
Never add a private column to that view.

> This is the answer to "I shipped a table without RLS". RLS lives in the
> database, so a forgotten policy is a **build-time** failure, not a
> production incident.

---

## RLS policy tests

`supabase/rls-tests.sql` is a pgTAP suite covering the policies above.

**89 assertions, all green against real Supabase.**

```bash
# Against a remote database (Supabase) — no local Postgres needed.
# This is the one to use from a phone.
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
  ./supabase/verify-rls-remote.sh

# Locally — spins up a throwaway Postgres, no Docker needed
./supabase/verify-rls.sh

# On Supabase Cloud — paste into the SQL editor
```

The suite creates its own `rls_test` schema and **rolls back** — your real
tables are never touched, so it is safe to point at production.

The same suite runs automatically in CI on every push
(`.github/workflows/rls-tests.yml`).

---

## Project structure

```
app/
  page.tsx                  # home + the marketplace (filters + grid)
  actions.ts                # server actions: every write goes through here
  list-your-land/page.tsx   # post a listing (auth)
  listings/[id]/page.tsx    # listing detail + the enquiry form
  dashboard/page.tsx        # seller inbox, your listings, enquiries sent (auth)
  admin/page.tsx            # THE ADMIN PANEL (auth + admin/operator)
  saved/page.tsx            # my shortlist (auth)
  login/page.tsx            # sign in / sign up
  how-it-works/page.tsx     # the explainer page
  not-found.tsx             # 404
  error.tsx                 # error boundary
  auth/callback/route.ts    # OAuth code exchange
  api/auth/signout/route.ts # sign out
components/
  Nav.tsx Footer.tsx        # chrome
  MobileNav.tsx             # mobile drawer
  ListingForm.tsx           # post a listing (useActionState)
  EnquiryForm.tsx           # ask the seller (useActionState)
  ListingRowActions.tsx     # status / delete (useActionState)
  EnquiryActions.tsx        # mark replied / withdraw (useActionState)
  FilterBar.tsx             # search + filters (debounced)
  ListingCard.tsx ListingGrid.tsx
  States.tsx                # spinner, empty state, error state, skeletons
  LoginForm.tsx SaveButton.tsx
lib/
  data.ts                   # every read and write, in one place
  db.ts                     # unwrap() - a failed query is an error, never fake data
  validation.ts             # zod schemas for both forms
  form-state.ts             # FormState + initialFormState (see the note below)
  types.ts                  # types + LAND_TYPES / REGIONS constants
  supabase/                 # client, server, proxy helpers
proxy.ts                    # session refresh (Next 16 renamed middleware.ts)
supabase/
  schema.sql                # tables, RLS policies, view, grants
  rls-tests.sql             # 33 pgTAP assertions
  verify-rls.sh             # run them on a local cluster
  verify-rls-remote.sh      # run them against Supabase
```

### One thing that will bite you

`app/actions.ts` has the `"use server"` directive, and Next only allows **async
functions** to be exported from a `"use server"` module. Exporting a plain
object from it — such as the `initialFormState` that `useActionState` needs —
means the client receives `undefined`, and the form dies with
`Cannot read properties of undefined`. That is why the initial state lives in
`lib/form-state.ts` instead.

---

## Notes for the Next.js 16 upgrade

If you ported this from Next 14/15, these are the things that break:

- `middleware.ts` → **`proxy.ts`**, and `export function middleware` →
  `export function proxy`. The Supabase session-refresh code is identical.
- `params`, `searchParams`, `cookies()`, `headers()` are all **async** now.
- Turbopack is the default bundler. `next lint` was **removed** — run
  `eslint` directly.
- `eslint-config-next` 16 ships native flat config. Do **not** wrap it in
  `FlatCompat` — it crashes with "Converting circular structure to JSON".
- `react-hooks/set-state-in-effect` is an **error** in the Next 16 config.
  Close a drawer in the link's `onClick`, not in a `useEffect`.
- `images.qualities` defaults to `[75]`; `images.imageSizes` dropped `16`.

---

## Working on this from a phone (Termux)

This repo was built and pushed from an Android phone.

```bash
pkg install -y git gh
gh auth login --hostname github.com --git-protocol https --web --insecure-storage
gh auth setup-git
gh repo clone Alanwel/Landflow
```

- `gh auth login` prints a one-time code — approve it at
  `https://github.com/login/device` in the phone browser.
- Termux has no keyring, so `--insecure-storage` is required; the token is
  stored in `~/.config/gh/hosts.yml`.
- **Turbopack does not run on android/arm64** (no native bindings). You do
  not need it: GitHub Actions and Vercel do the building.
