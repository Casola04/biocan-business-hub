-- ============================================================
-- DISTRIBUTOR FEATURE MIGRATION
-- IMPORTANT: Before running this file, run ONE statement first
-- in its own SQL Editor query (enum changes can't share a transaction):
--
--     alter type app_role add value if not exists 'distributor';
--
-- Then run THIS whole file. Idempotent (safe to re-run).
-- ============================================================

-- 1. Add per-distributor split percentage (default 70) -------
alter table public.profiles
  add column if not exists split_pct numeric not null default 70;

alter table public.profiles drop constraint if exists profiles_split_pct_check;
alter table public.profiles
  add constraint profiles_split_pct_check
  check (split_pct >= 0 and split_pct <= 100);

-- 2. Add distributor_id to scoped tables ---------------------
alter table public.clients
  add column if not exists distributor_id uuid references auth.users(id) on delete set null;

alter table public.orders
  add column if not exists distributor_id uuid references auth.users(id) on delete set null;

alter table public.expenses
  add column if not exists distributor_id uuid references auth.users(id) on delete set null;

create index if not exists clients_distributor_id_idx  on public.clients(distributor_id);
create index if not exists orders_distributor_id_idx   on public.orders(distributor_id);
create index if not exists expenses_distributor_id_idx on public.expenses(distributor_id);

-- 4. Helper functions ----------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as 'select coalesce((select role = ''admin'' from public.profiles where id = auth.uid()), false)';

create or replace function public.is_distributor()
returns boolean
language sql
stable
security definer
set search_path = public
as 'select coalesce((select role = ''distributor'' from public.profiles where id = auth.uid()), false)';

-- 5. Enable RLS and drop ALL existing policies on the 3 tables
alter table public.clients  enable row level security;
alter table public.orders   enable row level security;
alter table public.expenses enable row level security;

-- (Names from common Supabase defaults + ours from previous attempts)
drop policy if exists "Enable read access for all users"   on public.clients;
drop policy if exists "Enable insert for authenticated"    on public.clients;
drop policy if exists "Enable update for authenticated"    on public.clients;
drop policy if exists "Enable delete for authenticated"    on public.clients;
drop policy if exists "clients_select" on public.clients;
drop policy if exists "clients_insert" on public.clients;
drop policy if exists "clients_update" on public.clients;
drop policy if exists "clients_delete" on public.clients;

drop policy if exists "Enable read access for all users"   on public.orders;
drop policy if exists "Enable insert for authenticated"    on public.orders;
drop policy if exists "Enable update for authenticated"    on public.orders;
drop policy if exists "Enable delete for authenticated"    on public.orders;
drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;
drop policy if exists "orders_delete" on public.orders;

drop policy if exists "Enable read access for all users"   on public.expenses;
drop policy if exists "Enable insert for authenticated"    on public.expenses;
drop policy if exists "Enable update for authenticated"    on public.expenses;
drop policy if exists "Enable delete for authenticated"    on public.expenses;
drop policy if exists "expenses_select" on public.expenses;
drop policy if exists "expenses_insert" on public.expenses;
drop policy if exists "expenses_update" on public.expenses;
drop policy if exists "expenses_delete" on public.expenses;

-- 6. Create the new RLS policies ------------------------------
-- Pattern (same for all three tables):
--   admin       -> see/edit everything
--   distributor -> only rows where distributor_id = auth.uid()
--   other       -> only rows where distributor_id is null (admin's data)

-- ---------- CLIENTS ----------
create policy "clients_select" on public.clients
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "clients_insert" on public.clients
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_distributor() and (distributor_id = auth.uid() or distributor_id is null))
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "clients_update" on public.clients
  for update to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  )
  with check (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "clients_delete" on public.clients
  for delete to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
  );

-- ---------- ORDERS ----------
create policy "orders_select" on public.orders
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "orders_insert" on public.orders
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_distributor() and (distributor_id = auth.uid() or distributor_id is null))
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "orders_update" on public.orders
  for update to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  )
  with check (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "orders_delete" on public.orders
  for delete to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
  );

-- ---------- EXPENSES ----------
create policy "expenses_select" on public.expenses
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "expenses_insert" on public.expenses
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_distributor() and (distributor_id = auth.uid() or distributor_id is null))
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "expenses_update" on public.expenses
  for update to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  )
  with check (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
    or (not public.is_admin() and not public.is_distributor() and distributor_id is null)
  );

create policy "expenses_delete" on public.expenses
  for delete to authenticated
  using (
    public.is_admin()
    or (public.is_distributor() and distributor_id = auth.uid())
  );

-- 7. Auto-stamp distributor_id on insert ---------------------
create or replace function public.set_distributor_id_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
begin
  if new.distributor_id is null and public.is_distributor() then
    new.distributor_id := auth.uid();
  end if;
  return new;
end;
$body$;

drop trigger if exists set_distributor_clients  on public.clients;
drop trigger if exists set_distributor_orders   on public.orders;
drop trigger if exists set_distributor_expenses on public.expenses;

create trigger set_distributor_clients  before insert on public.clients
  for each row execute function public.set_distributor_id_default();
create trigger set_distributor_orders   before insert on public.orders
  for each row execute function public.set_distributor_id_default();
create trigger set_distributor_expenses before insert on public.expenses
  for each row execute function public.set_distributor_id_default();

-- 8. Profiles RLS — admin can read every profile -------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select to authenticated
  using (public.is_admin() or id = auth.uid());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- DONE.
-- Next: see db/02-add-distributor.sql to add a distributor user.
-- ============================================================
