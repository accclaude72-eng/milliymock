-- ═══════════════════════════════════════════════════════════════════════════
-- Milliy Mock — Phase 1: question bank, mistake notebook, study plans.
-- Additive only: creates new tables; does NOT alter or delete existing data.
-- All writes go through the server (secret key). Students can only SELECT
-- their own rows (RLS). The question bank holds answer keys → no policies at all.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────── question bank (built from published booklets)
create table if not exists public.question_bank (
  id            text primary key,                       -- "<material_id>:<n>"
  material_id   text not null references public.materials (id) on delete cascade,
  n             integer not null check (n between 1 and 200),
  subject_code  text not null,
  topic         text,
  type          text not null check (type in ('Y1', 'O1', 'O')),
  stem_html     text not null check (length(stem_html) <= 20000),   -- sanitised question text
  options       jsonb not null default '[]'::jsonb,                 -- [{ "letter": "A", "html": "…" }]
  correct       text not null,                                      -- Y1 letter or O1 accepted answer (server-only)
  explanation   text check (length(explanation) <= 5000),
  difficulty    smallint check (difficulty between 1 and 5),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (material_id, n)
);
create index if not exists question_bank_subject_idx on public.question_bank (subject_code, topic) where active;

-- ───────────────────────────────────────────── mistake notebook
-- One row per (student, question). Spaced repetition: stage 0..4 → next review after 1, 3, 7, 14 days.
create table if not exists public.student_mistakes (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  question_id      text not null references public.question_bank (id) on delete cascade,
  subject_code     text not null,
  topic            text,
  last_answer      text,
  wrong_count      integer not null default 1 check (wrong_count >= 0),
  correct_streak   integer not null default 0 check (correct_streak >= 0),
  status           text not null default 'open' check (status in ('open', 'understood', 'resolved')),
  bookmarked       boolean not null default false,
  note             text check (length(note) <= 2000),
  review_stage     smallint not null default 0 check (review_stage between 0 and 4),
  next_review_at   timestamptz not null default now() + interval '1 day',
  first_seen_at    timestamptz not null default now(),
  last_wrong_at    timestamptz not null default now(),
  last_reviewed_at timestamptz,
  updated_at       timestamptz not null default now(),
  unique (user_id, question_id)
);
create index if not exists student_mistakes_due_idx on public.student_mistakes (user_id, next_review_at) where status <> 'resolved';
create index if not exists student_mistakes_status_idx on public.student_mistakes (user_id, status, subject_code);

-- Every graded answer to a bank question (from mocks and mistake practice). Idempotent per source,
-- so re-grading an attempt never double-counts. Also the history for "most repeated mistakes".
create table if not exists public.answer_events (
  source       text not null,                        -- "attempt:<id>" or "review:<uuid>"
  question_id  text not null references public.question_bank (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  correct      boolean not null,
  answer       text,
  at           timestamptz not null default now(),
  primary key (source, question_id)
);
create index if not exists answer_events_user_idx on public.answer_events (user_id, at desc);

-- ───────────────────────────────────────────── study plans
create table if not exists public.study_plans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  subject_code     text not null,
  target_score     integer check (target_score between 0 and 100),
  exam_date        date not null,
  current_estimate integer check (current_estimate between 0 and 100),
  daily_minutes    integer not null check (daily_minutes between 10 and 600),
  study_days       smallint[] not null default '{1,2,3,4,5,6}',   -- 0 = Sunday … 6 = Saturday
  priority_topics  text[] not null default '{}',
  status           text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- At most one non-archived plan per student and subject.
create unique index if not exists study_plans_one_live_idx on public.study_plans (user_id, subject_code) where status <> 'archived';

create table if not exists public.study_plan_tasks (
  id            bigint generated always as identity primary key,
  plan_id       uuid not null references public.study_plans (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  day           date not null,
  kind          text not null check (kind in ('practice', 'mistakes', 'topic_review', 'assessment', 'mock')),
  title         text not null check (length(title) <= 200),
  topic         text,
  target_count  integer check (target_count between 0 and 500),
  minutes       integer check (minutes between 0 and 600),
  status        text not null default 'todo' check (status in ('todo', 'done', 'skipped')),
  done_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists study_plan_tasks_user_day_idx on public.study_plan_tasks (user_id, day);
create index if not exists study_plan_tasks_plan_idx on public.study_plan_tasks (plan_id, day);

-- ───────────────────────────────────────────── Row Level Security
alter table public.question_bank     enable row level security;
alter table public.student_mistakes  enable row level security;
alter table public.answer_events     enable row level security;
alter table public.study_plans       enable row level security;
alter table public.study_plan_tasks  enable row level security;

-- question_bank: NO policies (contains correct answers) — server-only.

drop policy if exists "own mistakes" on public.student_mistakes;
create policy "own mistakes" on public.student_mistakes for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own answer events" on public.answer_events;
create policy "own answer events" on public.answer_events for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own plans" on public.study_plans;
create policy "own plans" on public.study_plans for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own plan tasks" on public.study_plan_tasks;
create policy "own plan tasks" on public.study_plan_tasks for select to authenticated using (user_id = (select auth.uid()));

-- No INSERT / UPDATE / DELETE policies anywhere: all changes go through server routes that
-- check ownership first (same model as the existing attempts table).
