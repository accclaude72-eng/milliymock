-- Milliy Mock — initial schema (Supabase / Postgres)
-- Safe to run on an empty project. Uses IF NOT EXISTS / ON CONFLICT, no DROP statements.
--
-- Design: each table stores the app's document in `doc jsonb` and exposes the fields used
-- for filtering, uniqueness and Row Level Security as GENERATED columns. All writes are done
-- by the Next.js server with the secret key after its own authorization checks; RLS gives
-- browsers read access only to their own rows (and nothing at all to answer keys / logs).

-- ───────────────────────────────────────────────────────────── reference data
create table if not exists public.subjects (
  id         text primary key,
  doc        jsonb not null,
  archived   boolean generated always as (coalesce((doc->>'archived')::boolean, false)) stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_formats (
  id           text primary key,
  doc          jsonb not null,
  subject_code text generated always as (doc->>'subjectCode') stored,
  updated_at   timestamptz not null default now()
);
create index if not exists exam_formats_subject_idx on public.exam_formats (subject_code);

-- ───────────────────────────────────────────────────────────── candidates
create sequence if not exists public.candidate_number_seq;

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  doc          jsonb not null,
  candidate_id text generated always as (doc->>'candidateId') stored,
  status       text generated always as (doc->>'status') stored,
  created_ms   bigint generated always as ((doc->>'createdAt')::bigint) stored,
  last_seen_ms bigint generated always as ((doc->>'lastSeenAt')::bigint) stored,
  updated_at   timestamptz not null default now(),
  constraint profiles_status_chk check (status in ('active', 'suspended'))
);
create unique index if not exists profiles_candidate_id_key on public.profiles (candidate_id);
create index if not exists profiles_created_idx on public.profiles (created_ms desc);

create table if not exists public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('candidate', 'teacher', 'reviewer', 'material_creator', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ───────────────────────────────────────────────────────────── test materials
create table if not exists public.materials (
  id           text primary key,
  doc          jsonb not null,
  status       text generated always as (doc->>'status') stored,
  subject_code text generated always as (doc->>'subjectCode') stored,
  format_id    text generated always as (doc->>'formatId') stored,
  created_ms   bigint generated always as ((doc->>'createdAt')::bigint) stored,
  published_ms bigint generated always as ((doc->>'publishedAt')::bigint) stored,
  updated_at   timestamptz not null default now(),
  constraint materials_status_chk check (status in ('draft', 'published', 'archived'))
);
create index if not exists materials_status_idx on public.materials (status, subject_code);

-- Answer keys + O2 rubrics. SECRET: no RLS policy at all → unreadable from any browser.
create table if not exists public.material_keys (
  id         text primary key references public.materials (id) on delete cascade,
  doc        jsonb not null,
  updated_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────── attempts
create table if not exists public.attempts (
  id           text primary key,
  doc          jsonb not null,
  user_id      uuid generated always as ((doc->>'uid')::uuid) stored,
  material_id  text generated always as (doc->>'materialId') stored,
  subject_code text generated always as (doc->>'subjectCode') stored,
  status       text generated always as (doc->>'status') stored,
  created_ms   bigint generated always as ((doc->>'createdAt')::bigint) stored,
  rev          integer generated always as ((doc->>'rev')::integer) stored,
  updated_at   timestamptz not null default now(),
  constraint attempts_user_fk foreign key (user_id) references auth.users (id) on delete cascade,
  constraint attempts_material_fk foreign key (material_id) references public.materials (id) on delete restrict,
  constraint attempts_status_chk check (status in ('in_progress', 'submitted', 'auto_graded', 'pending_review', 'graded', 'published'))
);
create index if not exists attempts_user_idx on public.attempts (user_id, created_ms desc);
create index if not exists attempts_material_idx on public.attempts (material_id);
create index if not exists attempts_status_idx on public.attempts (status, created_ms desc);
-- At most one running attempt per candidate per test (prevents double-start races).
create unique index if not exists attempts_one_running_idx on public.attempts (user_id, material_id) where status = 'in_progress';

-- ───────────────────────────────────────────────────────────── audit & rate limits
create table if not exists public.audit_logs (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text not null,
  action  text not null,
  target  text not null,
  details jsonb not null default '{}'::jsonb
);
create index if not exists audit_logs_at_idx on public.audit_logs (at desc);

-- Audit log is append-only, even for the server.
create or replace function public.audit_logs_immutable() returns trigger
language plpgsql as $$ begin raise exception 'audit_logs is append-only'; end $$;
drop trigger if exists audit_logs_no_change on public.audit_logs;
create trigger audit_logs_no_change before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  hits         integer not null
);

-- ───────────────────────────────────────────────────────────── helper functions (server only)
create or replace function public.next_candidate_number() returns bigint
language sql security definer set search_path = public as $$ select nextval('public.candidate_number_seq') $$;

-- Atomic fixed-window rate limiter. Returns true when the hit is allowed.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_ms integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hits integer;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_ms / 1000.0) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_ms / 1000.0) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

create or replace function public.rate_limit_reset(p_key text) returns void
language sql security definer set search_path = public as $$ delete from rate_limits where key = p_key $$;

revoke all on function public.next_candidate_number() from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_reset(text) from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────── Row Level Security
alter table public.subjects      enable row level security;
alter table public.exam_formats  enable row level security;
alter table public.profiles      enable row level security;
alter table public.user_roles    enable row level security;
alter table public.materials     enable row level security;
alter table public.material_keys enable row level security;
alter table public.attempts      enable row level security;
alter table public.audit_logs    enable row level security;
alter table public.rate_limits   enable row level security;

drop policy if exists "subjects readable" on public.subjects;
create policy "subjects readable" on public.subjects for select to anon, authenticated using (true);

drop policy if exists "formats readable" on public.exam_formats;
create policy "formats readable" on public.exam_formats for select to anon, authenticated using (true);

drop policy if exists "published materials readable" on public.materials;
create policy "published materials readable" on public.materials for select to anon, authenticated using (status = 'published');

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));

drop policy if exists "own roles" on public.user_roles;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own attempts" on public.attempts;
create policy "own attempts" on public.attempts for select to authenticated using (user_id = (select auth.uid()));

-- material_keys, audit_logs, rate_limits: intentionally NO policies (server-only).

-- ───────────────────────────────────────────────────────────── private storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('booklets', 'booklets', false, 52428800, array['text/html']),
  ('submissions', 'submissions', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;
-- No storage.objects policies: uploads use short-lived signed upload URLs and downloads use
-- short-lived signed URLs, both issued by the server after an ownership check.
