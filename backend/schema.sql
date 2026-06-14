-- SAFAL waitlist schema
-- Run this once against your database (Supabase: SQL Editor → paste → Run).

create table if not exists waitlist (
  id          bigserial primary key,
  email       text not null unique,
  created_at  timestamptz not null default now(),
  source      text default 'site'
);

-- Fast lookups / dedupe by email
create index if not exists waitlist_email_idx on waitlist (email);
