-- Veridex Phase 1: initial schema
-- Tables: profiles, holdings, watchlist, alerts
-- Every table has row-level security scoped to auth.uid()

-- =========================================================
-- profiles  (extends auth.users with app-specific fields)
-- =========================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  capital_available numeric(14,2),           -- INR available for investment
  risk_tolerance   text check (risk_tolerance in ('low','medium','high')),
  goal_horizon     text check (goal_horizon  in ('short','medium','long')),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- holdings  (positions the user is tracking)
-- =========================================================
create table if not exists public.holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  symbol      text not null,                 -- e.g. RELIANCE
  exchange    text not null default 'NSE',   -- NSE | BSE
  qty         numeric(14,4) not null check (qty > 0),
  buy_price   numeric(14,4) not null check (buy_price > 0),
  buy_date    date not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_holdings_user on public.holdings(user_id);

-- =========================================================
-- watchlist
-- =========================================================
create table if not exists public.watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  symbol      text not null,
  exchange    text not null default 'NSE',
  added_at    timestamptz not null default now(),
  unique (user_id, symbol, exchange)
);
create index if not exists idx_watchlist_user on public.watchlist(user_id);

-- =========================================================
-- alerts  (review nudges, anomaly flags, etc.)
-- =========================================================
create table if not exists public.alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,                 -- review | anomaly | news
  symbol      text,
  title       text not null,
  message     text,
  sent_at     timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists idx_alerts_user_unread on public.alerts(user_id) where read_at is null;

-- =========================================================
-- updated_at trigger (shared)
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists holdings_touch on public.holdings;
create trigger holdings_touch before update on public.holdings
  for each row execute function public.touch_updated_at();

-- =========================================================
-- Row-level security
-- =========================================================
alter table public.profiles  enable row level security;
alter table public.holdings  enable row level security;
alter table public.watchlist enable row level security;
alter table public.alerts    enable row level security;

-- profiles: read/update own
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- holdings: full CRUD on own rows
drop policy if exists "holdings_all_own" on public.holdings;
create policy "holdings_all_own" on public.holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- watchlist: full CRUD on own rows
drop policy if exists "watchlist_all_own" on public.watchlist;
create policy "watchlist_all_own" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- alerts: read + mark-read own; inserts happen server-side via service role
drop policy if exists "alerts_select_own" on public.alerts;
create policy "alerts_select_own" on public.alerts
  for select using (auth.uid() = user_id);
drop policy if exists "alerts_update_own" on public.alerts;
create policy "alerts_update_own" on public.alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
