-- Phase 11: full NSE instrument universe + live market snapshot
--
-- Replaces the 30-ticker hardcoded list with the complete Upstox NSE
-- equity master (~2,650 rows), plus a snapshot table that a scheduled
-- job keeps warm so the recommendation engine can filter on price and
-- liquidity without hitting the broker API for every candidate.

create extension if not exists pg_trgm with schema extensions;

-- =========================================================
-- instruments — the searchable universe
-- =========================================================
create table if not exists public.instruments (
  instrument_key   text primary key,
  trading_symbol   text not null,
  name             text not null,
  short_name       text,
  isin             text,
  exchange         text not null default 'NSE',
  segment          text not null,
  instrument_type  text not null,
  lot_size         integer,
  tick_size        numeric,
  updated_at       timestamptz not null default now()
);

create index if not exists instruments_symbol_idx
  on public.instruments (trading_symbol);
create index if not exists instruments_symbol_trgm
  on public.instruments using gin (trading_symbol extensions.gin_trgm_ops);
create index if not exists instruments_name_trgm
  on public.instruments using gin (name extensions.gin_trgm_ops);

-- =========================================================
-- market_snapshot — last known price/volume per instrument
-- Refreshed by the sync-snapshot edge function on a schedule.
-- =========================================================
create table if not exists public.market_snapshot (
  instrument_key  text primary key references public.instruments(instrument_key) on delete cascade,
  trading_symbol  text not null,
  last_price      numeric(14,4),
  prev_close      numeric(14,4),
  pct_change      numeric(10,4),
  volume          bigint,
  updated_at      timestamptz not null default now()
);

create index if not exists market_snapshot_price_idx
  on public.market_snapshot (last_price);
create index if not exists market_snapshot_volume_idx
  on public.market_snapshot (volume desc);

-- =========================================================
-- Relevance-ranked instrument search
--   exact symbol > symbol prefix > short-name prefix > name contains
-- =========================================================
create or replace function public.search_instruments(q text, lim integer default 20)
returns table (
  instrument_key text,
  trading_symbol text,
  name           text,
  short_name     text,
  last_price     numeric,
  pct_change     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.instrument_key,
    i.trading_symbol,
    i.name,
    i.short_name,
    s.last_price,
    s.pct_change
  from public.instruments i
  left join public.market_snapshot s using (instrument_key)
  where q <> ''
    and (
      i.trading_symbol ilike q || '%'
      or i.name        ilike '%' || q || '%'
      or i.short_name  ilike '%' || q || '%'
    )
  order by
    case
      when upper(i.trading_symbol) = upper(q)  then 0
      when i.trading_symbol ilike q || '%'     then 1
      when i.short_name    ilike q || '%'      then 2
      when i.name          ilike q || '%'      then 3
      else 4
    end,
    length(i.trading_symbol),
    i.trading_symbol
  limit least(lim, 50);
$$;

-- =========================================================
-- Row-level security
--   Reference data is world-readable to signed-in users.
--   Writes happen only via the service role (edge functions).
-- =========================================================
alter table public.instruments     enable row level security;
alter table public.market_snapshot enable row level security;

drop policy if exists "instruments_read" on public.instruments;
create policy "instruments_read" on public.instruments
  for select to authenticated using (true);

drop policy if exists "market_snapshot_read" on public.market_snapshot;
create policy "market_snapshot_read" on public.market_snapshot
  for select to authenticated using (true);

grant execute on function public.search_instruments(text, integer) to authenticated;
