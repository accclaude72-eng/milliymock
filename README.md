# Milliy Mock

Independent mock-exam platform for Uzbekistan's National Certificate (Milliy sertifikat) exams in **Biology, Chemistry, Mathematics and Physics**: official task structure (Y1 / Y2 / O1 / O2), server-authoritative timer, automatic grading, expert review of written work (M/A), and an admin panel for uploading HTML test booklets.

> Not affiliated with BMBA. Issues no certificates and never presents a raw percentage as an official Rasch score or certificate level.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 |
| Auth | **Supabase Auth** (email + password, email confirmation, password reset, optional Google) |
| Database | **Supabase Postgres** with Row Level Security — `supabase/migrations/` |
| Files | **Supabase Storage**, private buckets `booklets` (HTML tests) and `submissions` (O2 uploads) |
| Hosting | Vercel |

## 1. Supabase setup (one time)

1. **Run the database migration.** Supabase dashboard → **SQL Editor** → New query → paste the whole file
   `supabase/migrations/20261127000000_init.sql` → **Run**.
   It only creates things (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`); it drops or overwrites nothing.
   It creates the tables, RLS policies, helper functions and the two private storage buckets.
2. **Authentication → URL Configuration**
   - *Site URL*: your live address, e.g. `https://your-site.vercel.app`
   - *Redirect URLs*: add `https://your-site.vercel.app/**` and `http://localhost:3000/**`
3. **Authentication → Providers → Email**: keep *Confirm email* on (recommended). Users get a link, click it, and land in their dashboard with the profile they filled in at registration.
4. *(Optional)* **Authentication → Providers → Google**: enable it, then set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`.
5. *(Recommended)* Supabase's built-in email sender is heavily rate-limited on the free plan. For real users add your own SMTP under **Authentication → Emails → SMTP Settings**.

Subjects and the four official exam formats are inserted automatically on the first request.

## 2. Environment variables

Names are in `.env.example`. Values come from **Supabase → Project Settings → API**.

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` *(or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)* | browser (public key, safe to expose) |
| `SUPABASE_SECRET_KEY` *(or `SUPABASE_SERVICE_ROLE_KEY`)* | **server only** — never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | links in confirmation / reset emails |
| `ADMIN_CODE_HASH`, `ADMIN_SESSION_SECRET` | admin panel (see §4) |

If you connected Supabase through the **Vercel integration**, the Supabase variables are already set in Vercel. You only need to add `NEXT_PUBLIC_SITE_URL`, `ADMIN_CODE_HASH` and `ADMIN_SESSION_SECRET`.

**Local:** create `.env.local` in the project folder (it's gitignored), copy the names from `.env.example` and type your values in. Never put keys in source code.

## 3. Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
```

Health check: `http://localhost:3000/api/health` shows whether Supabase and the admin settings are configured.

## 4. Admin panel

`/admin`, protected by a secret code. Only a salted scrypt **hash** of the code is stored, never the code itself.

```bash
npm run admin:hash -- "your-admin-code"
```

Paste the two printed lines into `.env.local` **and** into Vercel → Settings → Environment Variables, then redeploy. Sessions use an httpOnly, SameSite=Strict signed cookie (8 h). Failed attempts are rate-limited (5 per 15 min per IP) and every login is written to the audit log.

The admin can upload HTML tests (processed and previewed in the browser, then stored in the private `booklets` bucket), enter answer keys, publish, see all new users (search, block, password-reset email, CSV export), review O2 written work with separate M/A scores, publish results, and edit exam formats.

## 5. Deploy (GitHub → Vercel)

```bash
git add -A
git commit -m "Switch from Firebase to Supabase"
git remote add origin https://github.com/<you>/<repo>.git   # only once
git push -u origin master
```

Vercel → import the repo (framework: Next.js; defaults are fine) → add the environment variables from §2 → Deploy. After the first deploy, put the real domain into `NEXT_PUBLIC_SITE_URL` and into Supabase → Authentication → URL Configuration, then redeploy.

## 6. Security model

- **All** writes go through Next.js route handlers that verify the user's Supabase access token (`Authorization: Bearer`) or the admin cookie, validate input with Zod, and check ownership. They use the secret key server-side only.
- **RLS is enabled on every table.** Browsers may read only: subjects, exam formats, published materials, *their own* profile, roles and attempts. Answer keys (`material_keys`), audit logs and rate limits have no policies at all, so they are unreadable from any browser.
- The audit log is append-only (a trigger blocks UPDATE/DELETE).
- Storage buckets are **private** with size/type limits (HTML ≤ 50 MB; JPG/PNG/PDF ≤ 10 MB). Uploads use one-time signed upload URLs; downloads use short-lived signed URLs issued only after an ownership check.
- Attempts use optimistic concurrency (`rev`): timer expiry, autosave and submission can't lose or duplicate answers. A unique index allows one running attempt per candidate per test.

## 7. Data model (`supabase/migrations/20261127000000_init.sql`)

Each table stores the app document in `doc jsonb` and exposes the fields used for filtering, uniqueness and RLS as generated columns.

`subjects`, `exam_formats` (versioned), `profiles` (Candidate ID `MM-YY-000001` from a sequence), `user_roles`, `materials` (exam variants + format snapshot), `material_keys` (secret answer keys and O2 rubrics), `attempts` (answers, server timer, grading, O2 files and reviews, status history), `audit_logs`, `rate_limits`.

## 8. Not implemented yet

- Separate teacher / reviewer / material-creator accounts (`user_roles` exists; review is done by the admin today).
- A normalized question bank, Rasch parameter import and official scaling (deliberately off until official data exist).
- Email/Telegram result notifications, payments, Russian UI.

## Official sources

BMBA: <https://uzbmb.uz/page/fanlar> · Biology 2025, Chemistry 2025, Mathematics 2024, Physics 2024 specifications · Cabinet of Ministers Resolution No. 646 (<https://lex.uz/acts/-5044726>).
