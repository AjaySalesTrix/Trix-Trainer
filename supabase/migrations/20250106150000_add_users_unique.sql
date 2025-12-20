-- Ensure Clerk user id is unique in users table
create unique index if not exists users_clerk_user_id_key
  on public.users (clerk_user_id);
