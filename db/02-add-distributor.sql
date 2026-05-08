-- ============================================================
-- ADD A NEW DISTRIBUTOR
-- ------------------------------------------------------------
-- 1. In Supabase → Authentication → Users → "Add user"
--    Create with: email + password. Copy the user UUID.
--
-- 2. Run the snippet below, replacing the placeholders.
--    (split_pct is optional — defaults to 70 if omitted.)
-- ============================================================

-- Replace these:
--   <USER_UUID>      the UUID from step 1
--   <USERNAME>       short login name your distributor will type at /login
--   <DISPLAY_NAME>   their full name (shown in admin lists)
--   <EMAIL>          must match the email used in step 1
--   <SPLIT_PCT>      e.g. 70  (or 80, 65 — any 0-100 number)

insert into public.profiles (id, username, full_name, email, role, split_pct)
values (
  '<USER_UUID>',
  '<USERNAME>',
  '<DISPLAY_NAME>',
  '<EMAIL>',
  'distributor',
  70
)
on conflict (id) do update
  set role       = excluded.role,
      username   = excluded.username,
      full_name  = excluded.full_name,
      email      = excluded.email,
      split_pct  = excluded.split_pct;

-- To CHANGE a distributor's split later:
-- update public.profiles set split_pct = 65 where username = '<USERNAME>';

-- To DEACTIVATE a distributor (keep their data, block login):
-- In Supabase → Authentication → Users → … → Ban / delete user.
