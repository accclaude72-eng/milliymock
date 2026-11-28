-- ═══════════════════════════════════════════════════════════════════════════
-- Milliy Mock — Phase 4: flashcards (SM-2), video lessons, question discussions.
-- Additive only: new tables. No existing table or row is changed.
-- All writes go through the server (secret key). Students may SELECT only their
-- own personal rows (review state, video progress). Content tables are read via
-- the server, which applies the visibility rules (published, spoiler protection).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────── flashcards
create table if not exists public.flashcard_decks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users (id) on delete cascade,   -- null = official deck (admin)
  subject_code  text,
  title         text not null check (length(title) between 3 and 80),
  description   text check (length(description) <= 300),
  source        text not null default 'student' check (source in ('admin', 'student', 'mistakes')),
  status        text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists flashcard_decks_owner_idx on public.flashcard_decks (owner_id);
create index if not exists flashcard_decks_official_idx on public.flashcard_decks (subject_code) where owner_id is null;

create table if not exists public.flashcards (
  id           uuid primary key default gen_random_uuid(),
  deck_id      uuid not null references public.flashcard_decks (id) on delete cascade,
  front        text not null check (length(front) between 1 and 2000),
  back         text not null check (length(back) between 1 and 2000),
  question_id  text,                       -- card made from a bank question (mistakes deck)
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists flashcards_deck_idx on public.flashcards (deck_id, position);
create unique index if not exists flashcards_deck_question_uidx on public.flashcards (deck_id, question_id) where question_id is not null;

-- SM-2 state per student and card.
create table if not exists public.flashcard_reviews (
  user_id       uuid not null references auth.users (id) on delete cascade,
  card_id       uuid not null references public.flashcards (id) on delete cascade,
  ease          numeric(4, 2) not null default 2.5 check (ease between 1.3 and 5),
  interval_days integer not null default 0 check (interval_days between 0 and 3650),
  repetitions   integer not null default 0,
  lapses        integer not null default 0,
  due_on        date not null,
  last_grade    smallint check (last_grade between 0 and 5),
  reviewed_at   timestamptz,
  primary key (user_id, card_id)
);
create index if not exists flashcard_reviews_due_idx on public.flashcard_reviews (user_id, due_on);

-- ───────────────────────────────────────────── video lessons (YouTube / Vimeo links, no uploads)
create table if not exists public.video_lessons (
  id            uuid primary key default gen_random_uuid(),
  subject_code  text not null,
  topic         text check (length(topic) <= 120),
  title         text not null check (length(title) between 3 and 120),
  description   text check (length(description) <= 2000),
  provider      text not null check (provider in ('youtube', 'vimeo')),
  video_ref     text not null check (video_ref ~ '^[A-Za-z0-9_-]{5,40}$'),
  duration_sec  integer check (duration_sec between 1 and 36000),
  position      integer not null default 0,
  status        text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists video_lessons_subject_idx on public.video_lessons (subject_code, position);

create table if not exists public.video_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  video_id     uuid not null references public.video_lessons (id) on delete cascade,
  watched_sec  integer not null default 0 check (watched_sec >= 0),
  completed    boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, video_id)
);

-- ───────────────────────────────────────────── question discussions + moderation
create table if not exists public.discussions (
  id            uuid primary key default gen_random_uuid(),
  question_id   text not null,               -- question_bank id
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (length(display_name) between 2 and 40),
  body          text not null check (length(body) between 1 and 2000),
  status        text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at    timestamptz not null default now(),
  edited_at     timestamptz
);
create index if not exists discussions_question_idx on public.discussions (question_id, created_at);

create table if not exists public.discussion_replies (
  id             uuid primary key default gen_random_uuid(),
  discussion_id  uuid not null references public.discussions (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  display_name   text not null check (length(display_name) between 2 and 40),
  body           text not null check (length(body) between 1 and 2000),
  status         text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at     timestamptz not null default now(),
  edited_at      timestamptz
);
create index if not exists discussion_replies_thread_idx on public.discussion_replies (discussion_id, created_at);

-- "Foydali" votes on threads and replies (one per student per post).
create table if not exists public.discussion_votes (
  user_id      uuid not null references auth.users (id) on delete cascade,
  target_type  text not null check (target_type in ('thread', 'reply')),
  target_id    uuid not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table if not exists public.discussion_reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('thread', 'reply')),
  target_id    uuid not null,
  reporter_id  uuid not null references auth.users (id) on delete cascade,
  reason       text not null check (reason in ('spam', 'abuse', 'wrong', 'spoiler', 'other')),
  note         text check (length(note) <= 300),
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  unique (target_type, target_id, reporter_id)   -- one report per student per post
);
create index if not exists discussion_reports_open_idx on public.discussion_reports (status, created_at);

-- ───────────────────────────────────────────── Row Level Security
alter table public.flashcard_decks     enable row level security;
alter table public.flashcards          enable row level security;
alter table public.flashcard_reviews   enable row level security;
alter table public.video_lessons       enable row level security;
alter table public.video_progress      enable row level security;
alter table public.discussions         enable row level security;
alter table public.discussion_replies  enable row level security;
alter table public.discussion_votes    enable row level security;
alter table public.discussion_reports  enable row level security;

-- Content tables (decks, cards, videos, discussions, replies, reports): server-only (no policies).

drop policy if exists "own flashcard reviews" on public.flashcard_reviews;
create policy "own flashcard reviews" on public.flashcard_reviews for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own video progress" on public.video_progress;
create policy "own video progress" on public.video_progress for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own discussion votes" on public.discussion_votes;
create policy "own discussion votes" on public.discussion_votes for select to authenticated using (user_id = (select auth.uid()));
