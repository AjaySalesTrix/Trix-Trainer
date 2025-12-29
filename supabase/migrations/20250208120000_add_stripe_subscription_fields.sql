alter table public.users
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_status text,
  add column if not exists plan_name text,
  add column if not exists current_period_end timestamptz;

create index if not exists users_stripe_customer_id_idx
  on public.users (stripe_customer_id);
