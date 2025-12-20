create extension if not exists pgcrypto;

create table if not exists public.problem_clarity_profiles (
  user_id text primary key,
  email text,
  name text,
  product_name text,
  core_problem text,
  symptom_1 text,
  symptom_2 text,
  symptom_3 text,
  impact text,
  case_study_company text,
  case_study_challenge text,
  case_study_solution text,
  case_study_result text,
  updated_at timestamptz not null default now()
);

alter table public.problem_clarity_profiles enable row level security;

create policy "problem_clarity_profiles_select_own"
  on public.problem_clarity_profiles
  for select
  using (auth.uid()::text = user_id);

create policy "problem_clarity_profiles_insert_own"
  on public.problem_clarity_profiles
  for insert
  with check (auth.uid()::text = user_id);

create policy "problem_clarity_profiles_update_own"
  on public.problem_clarity_profiles
  for update
  using (auth.uid()::text = user_id);
