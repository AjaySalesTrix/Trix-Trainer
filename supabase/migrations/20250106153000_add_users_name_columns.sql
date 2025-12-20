alter table public.users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists full_name text;
