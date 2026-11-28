-- ═══════════════════════════════════════════════════════════════════════════
-- Milliy Mock — Phase 3: 1v1 battles, friends, study rooms.
-- Additive only: new tables, one helper function, realtime publication entries.
-- No existing table or row is changed. All writes go through the server
-- (secret key); students only get SELECT on rows they take part in.
-- Answers and correct keys stay in server-only tables (no policies).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────── friends
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users (id) on delete cascade,
  addressee_id  uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (requester_id <> addressee_id)
);
-- One relationship per pair, whichever side asked first.
create unique index if not exists friendships_pair_uidx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);

-- Short public code a student shares so friends can find them (no e-mail / Candidate ID search).
create table if not exists public.friend_codes (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  code     text not null unique check (code ~ '^[A-Z0-9]{6,10}$'),
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────── 1v1 battles
create table if not exists public.battles (
  id             uuid primary key default gen_random_uuid(),
  mode           text not null check (mode in ('random', 'friend', 'code')),
  subject_code   text not null default 'mixed',
  status         text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'cancelled', 'expired')),
  invite_code    text unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_by     uuid not null references auth.users (id) on delete cascade,
  invited_user   uuid references auth.users (id) on delete cascade,      -- friend battles
  question_count smallint not null default 7 check (question_count between 3 and 20),
  sec_per_question smallint not null default 30 check (sec_per_question between 10 and 120),
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  deadline_at    timestamptz,
  finished_at    timestamptz,
  winner_id      uuid references auth.users (id) on delete set null       -- null = draw / not finished
);
create index if not exists battles_waiting_idx on public.battles (subject_code, created_at) where status = 'waiting' and mode = 'random';
create index if not exists battles_created_idx on public.battles (created_at desc);

-- What each side may see live: progress only. Answers are in battle_answers (server-only).
create table if not exists public.battle_participants (
  battle_id     uuid not null references public.battles (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (length(display_name) between 2 and 40),
  answered      smallint not null default 0,
  correct       smallint,                 -- revealed only when the battle is finished
  duration_ms   integer,
  finished_at   timestamptz,
  joined_at     timestamptz not null default now(),
  primary key (battle_id, user_id)
);
create index if not exists battle_participants_user_idx on public.battle_participants (user_id, joined_at desc);

-- Questions (with order) and the answers given. Server-only: never readable by clients.
create table if not exists public.battle_questions (
  battle_id    uuid not null references public.battles (id) on delete cascade,
  position     smallint not null,
  question_id  text not null,
  primary key (battle_id, position)
);

create table if not exists public.battle_answers (
  battle_id    uuid not null references public.battles (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  position     smallint not null,
  answer       text,
  is_correct   boolean not null,
  answered_ms  integer not null,
  created_at   timestamptz not null default now(),
  primary key (battle_id, user_id, position)   -- one answer per question, no re-answering
);

-- ───────────────────────────────────────────── study rooms
create table if not exists public.study_rooms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 3 and 60),
  subject_code  text,
  description   text check (length(description) <= 300),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  invite_code   text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  max_members   smallint not null default 20 check (max_members between 2 and 50),
  timer_mode    text check (timer_mode in ('focus', 'break')),      -- shared pomodoro
  timer_ends_at timestamptz,
  status        text not null default 'active' check (status in ('active', 'closed', 'hidden_by_admin')),
  created_at    timestamptz not null default now()
);

create table if not exists public.study_room_members (
  room_id       uuid not null references public.study_rooms (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'member')),
  display_name  text not null check (length(display_name) between 2 and 40),
  joined_at     timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),     -- "online" = seen in the last minute
  muted         boolean not null default false,
  primary key (room_id, user_id)
);
create index if not exists study_room_members_user_idx on public.study_room_members (user_id);

create table if not exists public.study_room_messages (
  id          bigint generated always as identity primary key,
  room_id     uuid not null references public.study_rooms (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  body        text not null check (length(body) between 1 and 1000),
  deleted     boolean not null default false,          -- moderation hides, never hard-deletes
  created_at  timestamptz not null default now()
);
create index if not exists study_room_messages_room_idx on public.study_room_messages (room_id, id desc);

-- Membership check used by policies (security definer avoids recursive RLS).
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from study_room_members where room_id = p_room and user_id = (select auth.uid()))
$$;
revoke all on function public.is_room_member(uuid) from public, anon;
grant execute on function public.is_room_member(uuid) to authenticated;

create or replace function public.is_battle_member(p_battle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from battle_participants where battle_id = p_battle and user_id = (select auth.uid()))
$$;
revoke all on function public.is_battle_member(uuid) from public, anon;
grant execute on function public.is_battle_member(uuid) to authenticated;

-- ───────────────────────────────────────────── Row Level Security (read-only for students)
alter table public.friendships          enable row level security;
alter table public.friend_codes         enable row level security;
alter table public.battles              enable row level security;
alter table public.battle_participants  enable row level security;
alter table public.battle_questions     enable row level security;
alter table public.battle_answers       enable row level security;
alter table public.study_rooms          enable row level security;
alter table public.study_room_members   enable row level security;
alter table public.study_room_messages  enable row level security;

-- battle_questions, battle_answers: server-only (no policies).

drop policy if exists "own friendships" on public.friendships;
create policy "own friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "own friend code" on public.friend_codes;
create policy "own friend code" on public.friend_codes for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "battle members read battle" on public.battles;
create policy "battle members read battle" on public.battles for select to authenticated
  using (public.is_battle_member(id));

drop policy if exists "battle members read progress" on public.battle_participants;
create policy "battle members read progress" on public.battle_participants for select to authenticated
  using (public.is_battle_member(battle_id));

drop policy if exists "room members read room" on public.study_rooms;
create policy "room members read room" on public.study_rooms for select to authenticated
  using (public.is_room_member(id));

drop policy if exists "room members read members" on public.study_room_members;
create policy "room members read members" on public.study_room_members for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "room members read messages" on public.study_room_messages;
create policy "room members read messages" on public.study_room_messages for select to authenticated
  using (public.is_room_member(room_id) and not deleted);

-- ───────────────────────────────────────────── Realtime (live updates; RLS still applies)
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['battles', 'battle_participants', 'study_rooms', 'study_room_members', 'study_room_messages'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
