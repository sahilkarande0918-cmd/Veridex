-- Phase 9: push token + alert dedupe key
alter table public.profiles
  add column if not exists push_token text;

-- Dedupe key so the nudger doesn't insert the same review reminder
-- twice for the same holding.
alter table public.alerts
  add column if not exists dedupe_key text;
create unique index if not exists alerts_user_dedupe_uk
  on public.alerts(user_id, dedupe_key)
  where dedupe_key is not null;
