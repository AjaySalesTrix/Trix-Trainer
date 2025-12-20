create extension if not exists pgcrypto;

drop table if exists public.problem_clarity_profiles;

create table if not exists public.problem_lab_rows (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  email text,
  name text,
  symptom text not null,
  impact text,
  root_cause text not null,
  case_study_company text,
  case_study_challenge text,
  case_study_solution text,
  case_study_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists problem_lab_rows_user_id_idx
  on public.problem_lab_rows (user_id);

create or replace function public.set_problem_lab_rows_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists problem_lab_rows_updated_at on public.problem_lab_rows;
create trigger problem_lab_rows_updated_at
before update on public.problem_lab_rows
for each row execute function public.set_problem_lab_rows_updated_at();

alter table public.problem_lab_rows enable row level security;

create policy "problem_lab_rows_select_own"
  on public.problem_lab_rows
  for select
  using (auth.uid()::text = user_id);

create policy "problem_lab_rows_insert_own"
  on public.problem_lab_rows
  for insert
  with check (auth.uid()::text = user_id);

create policy "problem_lab_rows_update_own"
  on public.problem_lab_rows
  for update
  using (auth.uid()::text = user_id);

create policy "problem_lab_rows_delete_own"
  on public.problem_lab_rows
  for delete
  using (auth.uid()::text = user_id);
