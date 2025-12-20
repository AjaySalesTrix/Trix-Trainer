create extension if not exists pgcrypto;

create table if not exists public.call_ended_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id text not null,
  email text null,
  name text null,
  phase text not null,
  node_id text null,
  path jsonb not null,
  reason text not null,
  note text null,
  source text not null,
  user_agent text null,
  constraint call_ended_events_phase_check
    check (phase in ('phase1', 'phase2', 'phase2_preview')),
  constraint call_ended_events_reason_check
    check (reason in ('not_covered', 'lost_control', 'disengaged')),
  constraint call_ended_events_source_check
    check (source in ('trainer_html_iframe', 'trainer_route')),
  constraint call_ended_events_note_len_check
    check (note is null or char_length(note) <= 500)
);

create index if not exists call_ended_events_user_created_at_idx
  on public.call_ended_events (user_id, created_at desc);
create index if not exists call_ended_events_reason_idx
  on public.call_ended_events (reason);
create index if not exists call_ended_events_node_id_idx
  on public.call_ended_events (node_id);

alter table public.call_ended_events enable row level security;

create policy "call_ended_events_select_own"
  on public.call_ended_events
  for select
  using (auth.uid()::text = user_id);

create policy "call_ended_events_insert_own"
  on public.call_ended_events
  for insert
  with check (auth.uid()::text = user_id);
