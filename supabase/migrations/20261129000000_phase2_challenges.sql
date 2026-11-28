-- ═══════════════════════════════════════════════════════════════════════════
-- Milliy Mock — Phase 2: daily challenges, XP, achievements, leaderboard.
-- Additive only: new tables + one read-only ranking function. No existing data changes.
-- All writes go through the server. Rewards are unique per (user, reason, ref), so the
-- same reward can never be granted twice — even with parallel requests.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────── settings (reward rules, later: bot templates)
create table if not exists public.app_settings (
  key         text primary key check (key ~ '^[a-z0-9_.-]{1,60}$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ───────────────────────────────────────────── daily challenges
create table if not exists public.daily_challenges (
  id             uuid primary key default gen_random_uuid(),
  day            date not null,                                   -- Uzbekistan calendar day
  subject_code   text not null default 'mixed',                   -- 'mixed' = all subjects
  title          text not null check (length(title) between 3 and 120),
  difficulty     smallint check (difficulty between 1 and 5),
  question_ids   text[] not null check (cardinality(question_ids) between 3 and 50),
  time_limit_sec integer not null default 600 check (time_limit_sec between 60 and 7200),
  one_attempt    boolean not null default true,
  xp_base        integer not null default 20 check (xp_base between 0 and 500),
  status         text not null default 'published' check (status in ('draft', 'published', 'archived')),
  source         text not null default 'auto' check (source in ('auto', 'admin')),
  created_at     timestamptz not null default now(),
  unique (day, subject_code)
);
create index if not exists daily_challenges_day_idx on public.daily_challenges (day desc);

create table if not exists public.challenge_attempts (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.daily_challenges (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  attempt_no    smallint not null default 1 check (attempt_no between 1 and 20),
  layout        jsonb not null,             -- per-student order of questions and options
  answers       jsonb not null default '{}'::jsonb,
  status        text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  started_at    timestamptz not null default now(),
  deadline_at   timestamptz not null,
  submitted_at  timestamptz,
  correct       integer,
  total         integer,
  percent       numeric(5, 1),
  duration_ms   integer,
  flagged       boolean not null default false,   -- suspiciously fast → admin review
  unique (challenge_id, user_id, attempt_no)
);
create index if not exists challenge_attempts_user_idx on public.challenge_attempts (user_id, started_at desc);
create index if not exists challenge_attempts_challenge_idx on public.challenge_attempts (challenge_id, percent desc);

-- ───────────────────────────────────────────── XP and achievements
create table if not exists public.xp_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  amount      integer not null check (amount between -10000 and 10000),
  reason      text not null check (reason in ('challenge', 'challenge_bonus', 'streak', 'mock', 'achievement', 'battle', 'admin_adjust')),
  ref         text not null,                 -- what it was for (challenge attempt id, date, attempt id…)
  subject_code text,
  created_at  timestamptz not null default now(),
  unique (user_id, reason, ref)              -- the same reward can never be granted twice
);
create index if not exists xp_ledger_time_idx on public.xp_ledger (created_at desc);
create index if not exists xp_ledger_user_idx on public.xp_ledger (user_id, created_at desc);

create table if not exists public.student_achievements (
  user_id    uuid not null references auth.users (id) on delete cascade,
  code       text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  earned_at  timestamptz not null default now(),
  primary key (user_id, code)
);

-- ───────────────────────────────────────────── leaderboard privacy (opt-in)
create table if not exists public.leaderboard_profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  is_public     boolean not null default false,          -- hidden unless the student opts in
  display_name  text check (length(display_name) between 2 and 40),
  hidden_by_admin boolean not null default false,        -- moderation
  updated_at    timestamptz not null default now()
);

-- Weekly rank snapshots → ranking history.
create table if not exists public.leaderboard_snapshots (
  week_start  date not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  rank        integer not null,
  xp          integer not null,
  primary key (week_start, user_id)
);

-- Ranking by XP in a time window (optionally one subject). Server-only (revoked from clients).
create or replace function public.xp_ranking(p_since timestamptz, p_subject text default null, p_limit integer default 100, p_offset integer default 0)
returns table (user_id uuid, xp bigint, rank bigint)
language sql stable security definer set search_path = public as $$
  select l.user_id, sum(l.amount)::bigint as xp, rank() over (order by sum(l.amount) desc)::bigint as rank
  from xp_ledger l
  where l.created_at >= p_since and (p_subject is null or l.subject_code = p_subject)
  group by l.user_id
  having sum(l.amount) > 0
  order by xp desc
  limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset)
$$;
revoke all on function public.xp_ranking(timestamptz, text, integer, integer) from public, anon, authenticated;

-- ───────────────────────────────────────────── Row Level Security
alter table public.app_settings          enable row level security;
alter table public.daily_challenges      enable row level security;
alter table public.challenge_attempts    enable row level security;
alter table public.xp_ledger             enable row level security;
alter table public.student_achievements  enable row level security;
alter table public.leaderboard_profiles  enable row level security;
alter table public.leaderboard_snapshots enable row level security;

-- app_settings, daily_challenges (question lists), leaderboard_snapshots: server-only (no policies).

drop policy if exists "own challenge attempts" on public.challenge_attempts;
create policy "own challenge attempts" on public.challenge_attempts for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own xp" on public.xp_ledger;
create policy "own xp" on public.xp_ledger for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own achievements" on public.student_achievements;
create policy "own achievements" on public.student_achievements for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own leaderboard profile" on public.leaderboard_profiles;
create policy "own leaderboard profile" on public.leaderboard_profiles for select to authenticated using (user_id = (select auth.uid()));
