-- ═══════════════════════════════════════════════════════════════════════════
-- Milliy Mock — Phase 5: mock result certificates + Telegram bot for students.
-- Additive only: new tables. No existing table or row is changed.
-- All writes go through the server (secret key). Students may SELECT only their own rows.
-- Certificates are platform "mock result" certificates, NOT official state certificates.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────── certificates
create table if not exists public.certificates (
  id             uuid primary key default gen_random_uuid(),
  serial         text not null unique check (serial ~ '^MM-[0-9]{4}-[A-Z0-9]{6}$'),   -- printed on the PDF
  verify_code    text not null unique check (verify_code ~ '^[A-Za-z0-9]{16,32}$'),  -- in the QR link
  user_id        uuid not null references auth.users (id) on delete cascade,
  attempt_id     text not null unique,                 -- one certificate per published attempt
  material_id    text not null,
  subject_code   text not null,
  material_title text not null,
  candidate_name text not null check (length(candidate_name) between 2 and 120),   -- snapshot at issue time
  candidate_id   text,
  score          numeric(7, 2),
  max_score      numeric(7, 2),
  percent        numeric(5, 1),
  level          text,                                 -- e.g. "A+", "B2" (platform estimate)
  issued_at      timestamptz not null default now(),
  status         text not null default 'valid' check (status in ('valid', 'revoked')),
  revoked_at     timestamptz,
  revoked_reason text check (length(revoked_reason) <= 300)
);
create index if not exists certificates_user_idx on public.certificates (user_id, issued_at desc);

-- Each public verification is logged (abuse monitoring). IP is stored only as a salted hash.
create table if not exists public.certificate_checks (
  id              bigint generated always as identity primary key,
  certificate_id  uuid references public.certificates (id) on delete cascade,
  code_tried      text not null check (length(code_tried) <= 64),
  found           boolean not null,
  ip_hash         text,
  checked_at      timestamptz not null default now()
);
create index if not exists certificate_checks_cert_idx on public.certificate_checks (certificate_id, checked_at desc);

-- ───────────────────────────────────────────── Telegram bot
create table if not exists public.telegram_links (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  chat_id     bigint not null unique,
  username    text check (length(username) <= 64),
  linked_at   timestamptz not null default now()
);

-- One-time codes: the student presses "Telegramni ulash", opens t.me/<bot>?start=<code>.
create table if not exists public.telegram_link_codes (
  code        text primary key check (code ~ '^[A-Za-z0-9]{16,40}$'),
  user_id     uuid not null references auth.users (id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists telegram_link_codes_user_idx on public.telegram_link_codes (user_id);

create table if not exists public.notification_prefs (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  results            boolean not null default true,   -- mock result published, certificate issued
  daily_challenge    boolean not null default true,   -- morning reminder
  plan_reminders     boolean not null default true,   -- study plan tasks for today
  battle_invites     boolean not null default true,
  mistakes_due       boolean not null default false,  -- mistakes due for review
  quiet_from         smallint check (quiet_from between 0 and 23),   -- Uzbekistan hour
  quiet_to           smallint check (quiet_to between 0 and 23),
  updated_at         timestamptz not null default now()
);

-- Every message sent (or skipped) once per (user, kind, ref) — no duplicate notifications.
create table if not exists public.notification_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  channel     text not null default 'telegram' check (channel in ('telegram')),
  kind        text not null check (kind ~ '^[a-z_]{2,40}$'),
  ref         text not null check (length(ref) <= 120),
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  error       text check (length(error) <= 300),
  created_at  timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index if not exists notification_log_time_idx on public.notification_log (created_at desc);

-- ───────────────────────────────────────────── Row Level Security
alter table public.certificates         enable row level security;
alter table public.certificate_checks   enable row level security;
alter table public.telegram_links       enable row level security;
alter table public.telegram_link_codes  enable row level security;
alter table public.notification_prefs   enable row level security;
alter table public.notification_log     enable row level security;

-- certificate_checks, telegram_link_codes: server-only (no policies).
-- Public certificate verification goes through the server, which shows only limited fields.

drop policy if exists "own certificates" on public.certificates;
create policy "own certificates" on public.certificates for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own telegram link" on public.telegram_links;
create policy "own telegram link" on public.telegram_links for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own notification prefs" on public.notification_prefs;
create policy "own notification prefs" on public.notification_prefs for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own notification log" on public.notification_log;
create policy "own notification log" on public.notification_log for select to authenticated using (user_id = (select auth.uid()));
