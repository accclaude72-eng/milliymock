# Milliy Mock

An independent mock-exam platform for Uzbekistan's National Certificate (Milliy sertifikat) exams in **Biology, Chemistry, Mathematics and Physics**. It follows the official task structure (Y1 / Y2 / O1 / O2), uses a server-authoritative timer, grades automatically, routes written responses to expert review, and gives admins a panel for uploading HTML test booklets to Firebase.

> The platform is **not** affiliated with the Agency for Assessment of Knowledge and Skills (BMBA), issues no certificates and never presents a raw percentage as an official Rasch score or certificate level.

---

## 1. Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components) + React 19 + TypeScript |
| Styling | Tailwind CSS v4, custom design system (`src/app/globals.css`) — light mode only |
| Auth | Firebase Authentication (email/password, optional Google) |
| Database | Cloud Firestore — **server-only** via Firebase Admin SDK |
| Files | Firebase Cloud Storage — HTML booklets and O2 uploads, private |
| Validation | Zod on every API route |
| Tests | Vitest (grading engine, timer state machine, key parser) |

> The master prompt suggested Supabase; you asked for Firebase, so the same logical model is implemented on Firestore + Storage with server-side authorization instead of RLS (see §6).

## 2. Firebase setup (production)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method**: enable *Email/Password* (and *Google* if you want it; then set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`). Under *Templates* you can set the email language/sender.
3. **Firestore Database** → create (production mode, region close to Uzbekistan, e.g. `europe-west`).
4. **Storage** → get started (same region).
5. **Project settings → General → Your apps → Web app** → copy the config into `NEXT_PUBLIC_FIREBASE_*` in `.env.local`.
6. **Project settings → Service accounts → Generate new private key** → copy `project_id`, `client_email`, `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (one line, keep the `\n` sequences, wrap in quotes). `FIREBASE_STORAGE_BUCKET` = your bucket name (e.g. `my-project.firebasestorage.app`).
7. Deploy the security rules (they deny all direct Firestore access and only allow tightly scoped Storage uploads):
   ```bash
   npx firebase login
   npx firebase deploy --only firestore:rules,storage --project <your-project-id>
   ```
8. Allow the site to read booklets from Storage (CORS). Edit `cors.json` (put your domain), then:
   ```bash
   gcloud storage buckets update gs://<your-bucket> --cors-file=cors.json
   ```
   Booklets are fetched with short-lived URLs and rendered in a sandboxed `srcdoc` frame. Without CORS the player falls back to loading the URL directly in the same sandbox, so it still works, but CORS is the recommended setup.
9. Grant the service account permission to sign URLs (for short-lived file links): in Google Cloud IAM give the `firebase-adminsdk-…` account the role **Service Account Token Creator** on itself. If this is missing the app falls back to Firebase download-token links that are still only handed out by authorized server routes.

The database seeds itself on first request: four subjects and their format versions (Biology 2025, Chemistry 2025, Mathematics 2024, Physics 2024).

## 3. Running locally

```bash
npm install
npm run dev            # uses .env.local (real Firebase)
```

### Fully offline with the Firebase Emulator Suite (no Google account needed)

Requires Java 11+.

```bash
npm run emulators      # terminal 1 — Auth :9099, Firestore :8080, Storage :9199, UI :4000
npm run dev:emu        # terminal 2 — Next.js pointed at the emulators via .env.emulators
```

Open <http://localhost:3000>. Emulator data is wiped when the emulators stop. Verification and password-reset emails appear in the Emulator UI (<http://127.0.0.1:4000/auth>).

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `dev:emu` | Dev server (real Firebase / emulators) |
| `npm run build` / `start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm test` | Vitest unit tests |
| `npm run emulators` | Firebase Auth/Firestore/Storage emulators |
| `npm run admin:hash -- "code"` | Generates `ADMIN_CODE_HASH` + `ADMIN_SESSION_SECRET` |

## 4. Admin access (secret code)

* The admin panel lives at **`/admin`** and is not linked anywhere on the public site.
* Access requires the admin code. The code is **never** stored in the repository, the browser bundle, or even in plain text in env files — only a salted **scrypt hash** (`ADMIN_CODE_HASH`) is kept in `.env.local` / your hosting provider's secret settings.
* To set or change the code: `npm run admin:hash -- "new-code"`, paste both printed lines into `.env.local` (and into Vercel → Settings → Environment Variables), restart. Changing `ADMIN_SESSION_SECRET` logs out every admin session immediately.
* Sessions: httpOnly, `SameSite=Strict`, `Secure` (in production) cookie signed with HMAC-SHA256, valid 8 hours.
* Brute force protection: 5 failed attempts per IP per 15 minutes + a global cap, stored in Firestore so it holds across serverless instances. Every success and failure is written to the audit log.
* `/admin/*` pages are guarded by `src/proxy.ts`; **every** `/api/admin/*` route re-checks the session itself.

## 5. Uploading HTML test materials (admin)

`/admin/materiallar/yangi`:

1. Pick the subject and mode — **full mock** (official timing), **topic practice** (task range, timer optional) or **short diagnostic** (task range, timed).
2. Drop the `.html` file **together with its images/CSS**. Word "Save as Web Page" exports: select the HTML *and* every file in the `…_files` folder.
3. The browser processes the file before anything is uploaded:
   * detects the encoding (BOM / `<meta charset>` / Windows-1251 fallback) and converts to UTF-8;
   * inlines local images, VML images, CSS files and `url()` references as data URIs, so the booklet is self-contained;
   * removes `<base>`, meta refresh, `<object>/<embed>`; optionally strips all JavaScript;
   * reports missing images, external resources, empty files, size (≤ 50 MB) and which task numbers could not be found in the text;
   * shows a sandboxed preview.
4. The processed file is uploaded **directly to Firebase Storage** with a short-lived admin token (no web-server size limit), and a **draft** material is created in Firestore.
5. Enter the answer key — bubbles for Y1, selects for Y2 pairs, accepted answers / tolerance / unit / case for O1, M/A rubric criteria for O2 — or paste it (`ABCD…`, `1A 2B`, `33: ACBD`, `36: 0,25 | 1/4`). Validation runs live and again on the server.
6. **Publish** is only possible once the key is complete. Materials with attempts can only be archived, never deleted (history is preserved).

Candidates see the booklet in a **sandboxed, cross-origin iframe** next to the digital answer sheet — the same split as the real paper exam (test booklet + javoblar varaqasi).

## 6. Architecture & security

```
src/
  app/
    (site)/…            public + candidate pages (landing, auth, dashboard, subjects, results)
    urinish/[id]        full-screen exam player
    admin/kirish        admin code screen
    admin/(panel)/…     admin panel (materials, results/review, users, formats, audit)
    api/…               route handlers (all data access)
  components/           UI, exam player, admin widgets
  lib/
    formats.ts          versioned official exam formats (seed) + helpers
    grading.ts          pure grading engine (Y1/Y2/O1, O2 totals)
    timing.ts           pure server-timer state machine
    sheet.ts            answer-sheet layout + key validation
    booklet.ts          client-side HTML booklet processor
    server/…            Firebase Admin, auth, attempts engine, results, schemas
  proxy.ts              /admin page guard
firestore.rules, storage.rules, firebase.json
tests/                  Vitest unit tests
```

**Authorization model.** Browsers have *no* direct Firestore access (`firestore.rules` denies everything). Every read/write goes through a route handler that verifies the Firebase ID token (candidates) or the signed admin cookie, validates input with Zod, and enforces ownership. Answer keys live in a separate `materialKeys` collection and are only read server-side; they are never sent to candidates before publication, and only when the admin allows answer disclosure. Storage objects are never public: candidates may only *create* files under `submissions/{their uid}/…` (≤ 10 MB, JPG/PNG/PDF), the admin uploader may only create `materials/…` HTML; reading always happens through short-lived URLs issued after an ownership check.

**Firestore collections.** `subjects`, `formats` (versioned), `materials` (+ format snapshot), `materialKeys` (secret), `profiles` (Candidate ID `MM-YY-000001` allocated transactionally), `attempts` (format snapshot, answers, timing, grading, O2 reviews, status history), `auditLogs`, `rateLimits`, `meta`.

**Attempt lifecycle.** `in_progress → submitted → auto_graded → pending_review → graded → published`, or `auto_graded → published` when nothing needs a human. Every mutation runs in a Firestore transaction that first reconciles the server clock: when a stage's deadline passes it is closed *at the deadline* and the next stage starts at that instant; when the last stage ends the attempt is finalized and graded atomically. Submission, stage advance and grading are idempotent; a timer expiry racing a manual submit cannot lose or duplicate answers.

**Exam player.** Server-synchronized countdown (clock offset measured on every response), debounced autosave, offline queue in `localStorage` replayed on reconnect, `keepalive` save on tab close, 15-second heartbeat, two-tab conflict detection with explicit takeover, locked previous stages, navigator with text/icon states (not colour alone), mobile tabs + bottom-sheet navigator, Y2 drag-and-drop with select fallback, O2 text + JPG/PNG/PDF uploads.

## 7. Assessment rules — what the platform does and does not claim

* **Raw result** (correct / incorrect / partial / unanswered / percentage, by task type and topic) — always shown.
* **Rasch score** — only if a calibrated parameter set is attached to the format. None ship by default, so it is never shown.
* **O2 written scores** — expert rubric, M (method) and A (arithmetic) stored separately, per-criterion comments, error tags, audit trail of every change.
* **Official level (A+ … C)** — shown only as information; never computed from mock results (no official scaling table). The 70.0 boundary is flagged as needing clarification.
* **Y2 scoring** — per-pair by default and marked *unconfirmed* in each format until an admin confirms it against the official source (Formats page).
* **O1** — normalization (Unicode/NFKC, decimal comma, fractions, scientific notation, apostrophes, case rules, tolerance, units). Anything that cannot be verified as equivalent goes to `needs_review` for a human, never auto-accepted.

## 8. Managing official specifications

`/admin/formatlar`: edit a format's sections/timers, task groups, O2 maxima, topics, source URL and Y2 rule; **"Duplicate → new version"** when BMBA publishes a new specification, edit it, then set it as the subject's active format. Materials and attempts keep their own snapshot, so old results never change. New subjects (e.g. after Resolution No. 411) are added from a template and appear on the site automatically.

## 9. Deployment (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add every variable from `.env.example` in *Settings → Environment Variables* (paste `FIREBASE_PRIVATE_KEY` with `\n` escapes).
3. Deploy. Add your production domain to Firebase *Authentication → Settings → Authorized domains*.

Any Node 20.9+ host works (`npm run build && npm start`).

## 10. QA status

| Check | Status |
| --- | --- |
| `npm run typecheck` | passing |
| `npm run lint` | passing |
| `npm test` (31 tests: formats, Y1/Y2/O1 grading, O2 rubric, timer, key parser) | passing |
| `npm run build` | see final report in the conversation / CI |
| End-to-end flows against Firebase emulators | see final report |

## 11. Not implemented yet / needs configuration

* **Real Firebase credentials** — required for production (§2). Until then the site shows a "Firebase not configured" notice instead of failing.
* Separate **Teacher / Material Creator / Reviewer / Super Admin roles**: the current model is *candidate* + *admin (code)*. Review is done by the admin.
* Second reviewer / moderation workflow, annotations drawn on uploaded images/PDFs, OCR / AI-assisted scoring, AI question generation.
* Rasch parameter import and official 0–100 scaling (intentionally disabled until official data exist).
* Email/Telegram result notifications beyond Firebase's built-in verification and password-reset emails.
* Subscriptions/payments, banners/announcements.
* Rich-text/LaTeX editor for O2 (plain text with a symbol toolbar + file uploads are provided).
* Russian localization (UI strings are Uzbek Latin).

## Official sources

1. BMBA — National Testing System: <https://uzbmb.uz/page/milliytest>
2. Subject specifications: <https://uzbmb.uz/page/fanlar>
3. Sample tasks: <https://www.uzbmb.uz/page/namuna_m>
4. Biology 2025: <https://www.uzbmb.uz/upload/file/pdf/mtt/spetsifikatsiya/Biologiya-MS2025.pdf>
5. Chemistry 2025: <https://www.uzbmb.uz/upload/file/pdf/mtt/spetsifikatsiya/Kimyo-MS2025.pdf>
6. Mathematics 2024: <https://uzbmb.uz/upload/file/pdf/mtt/spetsifikatsiya/Matematika_2024.pdf>
7. Physics 2024: <https://www.uzbmb.uz/upload/file/pdf/mtt/spetsifikatsiya/Fizika_2024.pdf>
8. Cabinet of Ministers Resolution No. 646: <https://lex.uz/acts/-5044726>
9. Resolution No. 411 (29.07.2026): <https://lex.uz/docs/-8362485>
