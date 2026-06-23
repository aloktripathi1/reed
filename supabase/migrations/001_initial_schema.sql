-- Goals
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'active'
                check (status in ('active', 'resolved', 'abandoned')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Behavioral signals
create table public.behavioral_signals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  type              text not null
                      check (type in ('doubt', 'undervalued_strength', 'avoidance_pattern', 'other')),
  description       text not null,
  first_observed_at timestamptz not null default now(),
  last_observed_at  timestamptz not null default now(),
  occurrence_count  integer not null default 1,
  related_goal_id   uuid references public.goals(id) on delete set null
);

-- Sessions (before commitments; FK back-filled after)
create table public.sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  opened_with_nudge   boolean not null default false,
  nudge_commitment_id uuid
);

-- Commitments
create table public.commitments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  description       text not null,
  source_session_id uuid references public.sessions(id) on delete set null,
  target_timeframe  text,
  status            text not null default 'open'
                      check (status in ('open', 'fulfilled', 'acknowledged_not_done', 'expired')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

-- Back-fill circular FK
alter table public.sessions
  add constraint sessions_nudge_commitment_id_fkey
  foreign key (nudge_commitment_id) references public.commitments(id) on delete set null;

-- Messages
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

-- Auto-update updated_at on goals
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.handle_updated_at();

-- Indexes (session-open check is the hot path)
create index idx_commitments_user_status on public.commitments (user_id, status, created_at);
create index idx_behavioral_signals_user on public.behavioral_signals (user_id, last_observed_at);
create index idx_sessions_user on public.sessions (user_id, started_at);
create index idx_messages_session on public.messages (session_id, created_at);

-- RLS
alter table public.goals enable row level security;
alter table public.behavioral_signals enable row level security;
alter table public.sessions enable row level security;
alter table public.commitments enable row level security;
alter table public.messages enable row level security;

create policy "own_goals_select" on public.goals for select using (auth.uid() = user_id);
create policy "own_goals_insert" on public.goals for insert with check (auth.uid() = user_id);
create policy "own_goals_update" on public.goals for update using (auth.uid() = user_id);
create policy "own_goals_delete" on public.goals for delete using (auth.uid() = user_id);

create policy "own_signals_select" on public.behavioral_signals for select using (auth.uid() = user_id);
create policy "own_signals_insert" on public.behavioral_signals for insert with check (auth.uid() = user_id);
create policy "own_signals_update" on public.behavioral_signals for update using (auth.uid() = user_id);
create policy "own_signals_delete" on public.behavioral_signals for delete using (auth.uid() = user_id);

create policy "own_sessions_select" on public.sessions for select using (auth.uid() = user_id);
create policy "own_sessions_insert" on public.sessions for insert with check (auth.uid() = user_id);
create policy "own_sessions_update" on public.sessions for update using (auth.uid() = user_id);
create policy "own_sessions_delete" on public.sessions for delete using (auth.uid() = user_id);

create policy "own_commitments_select" on public.commitments for select using (auth.uid() = user_id);
create policy "own_commitments_insert" on public.commitments for insert with check (auth.uid() = user_id);
create policy "own_commitments_update" on public.commitments for update using (auth.uid() = user_id);
create policy "own_commitments_delete" on public.commitments for delete using (auth.uid() = user_id);

-- Messages scoped via session ownership
create policy "own_messages_select" on public.messages for select using (
  exists (select 1 from public.sessions s where s.id = messages.session_id and s.user_id = auth.uid())
);

create policy "own_messages_insert" on public.messages for insert with check (
  exists (select 1 from public.sessions s where s.id = messages.session_id and s.user_id = auth.uid())
);
