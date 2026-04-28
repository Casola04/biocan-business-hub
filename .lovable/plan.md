# Add authentication for internal employee use

Lock the BioCan Pharma OS behind a Supabase email/password login. Only employees you create accounts for can sign in. Admins get extra permissions (delete records); employees can view and add.

## What you'll get

- A login screen at `/login` (no public signup — you create accounts in the Supabase dashboard)
- All app pages require sign-in; unauthenticated visitors are redirected to `/login`
- A user menu in the header showing the signed-in email + a Sign Out button
- Two roles: `admin` (full access including delete) and `employee` (view + create)
- All four data tables locked down with RLS so only authenticated users can read/write

## Step 1 — SQL to run in Supabase

Open Supabase → SQL Editor and run this once. It creates the four data tables, the profiles table, the role system, RLS policies, and a trigger that auto-creates a profile when you add a new user.

```sql
-- ================== ROLES ==================
create type public.app_role as enum ('admin', 'employee');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'employee',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Security definer function to check roles without recursive RLS
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = _user_id and role = _role)
$$;

-- Profile policies
create policy "users read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'employee');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ================== DATA TABLES ==================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  client_id text, name text not null, email text, phone text, notes text,
  created_at timestamptz default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_id text, name text not null, sku text,
  unit_cost numeric default 0, unit_price numeric default 0,
  stock_qty integer default 0, reorder_level integer default 0,
  notes text, created_at timestamptz default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text, date date,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  quantity integer default 0, unit_price numeric default 0,
  total numeric default 0, status text default 'Pending',
  notes text, month_key text, created_at timestamptz default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_id text, date date,
  category text default 'Supplies', vendor text default 'BioCan Pharma',
  amount numeric default 0, notes text, month_key text,
  created_at timestamptz default now()
);

-- ================== RLS ==================
alter table public.clients  enable row level security;
alter table public.products enable row level security;
alter table public.orders   enable row level security;
alter table public.expenses enable row level security;

-- Authenticated users: full read + insert + update on all business tables
-- Only admins can delete
do $$
declare t text;
begin
  foreach t in array array['clients','products','orders','expenses'] loop
    execute format('create policy "auth read %1$s"   on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy "auth insert %1$s" on public.%1$s for insert to authenticated with check (true)', t);
    execute format('create policy "auth update %1$s" on public.%1$s for update to authenticated using (true) with check (true)', t);
    execute format('create policy "admin delete %1$s" on public.%1$s for delete to authenticated using (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;
```

## Step 2 — Create employee accounts

In Supabase dashboard → **Authentication → Users → Add user → Create new user**.
- Enter email + password (uncheck "Auto Confirm User" if you want email verification, otherwise leave checked).
- Repeat for each employee.

To make someone an admin, run in SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Step 3 — Code I'll add

- `src/lib/auth.tsx` — `AuthProvider` + `useAuth()` hook (session, role, signIn, signOut). Subscribes to `onAuthStateChange` first, then fetches initial session. Profile fetch is deferred via `setTimeout` to avoid Supabase deadlock inside auth callbacks.
- `src/routes/login.tsx` — login form. Redirects to `/` if already signed in.
- `src/routes/__root.tsx` — wrap app in `<AuthProvider>`.
- `src/components/AppLayout.tsx` — gate all pages: while loading show spinner; if no session redirect to `/login`; otherwise render the app. Header gets a user menu (email + Sign Out).
- Delete buttons on Clients / Inventory / Orders / Expenses become admin-only (hidden for employees).
- `src/lib/supabase.ts` — enable session persistence in localStorage.

## Files changed / created

```text
src/lib/auth.tsx              (new)
src/lib/supabase.ts           (enable persistSession)
src/routes/login.tsx          (new)
src/routes/__root.tsx         (wrap in AuthProvider)
src/components/AppLayout.tsx  (auth gate + user menu)
src/routes/clients.tsx        (admin-only delete)
src/routes/inventory.tsx      (admin-only delete)
src/routes/orders.tsx         (admin-only delete)
src/routes/expenses.tsx       (admin-only delete)
```

## What I won't add (can do later if you want)

- Password reset flow (employees would email you for resets — fine for a small team)
- Audit log of who created which order/expense
- Per-user data scoping (currently any authenticated employee sees all data — appropriate for an internal tool)

Approve and I'll implement, then walk you through running the SQL and creating your first admin account.
