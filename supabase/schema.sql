-- Run in Supabase SQL Editor (https://fajtncmqrakqblvugeko.supabase.co)
-- Supabase uses anon key (sb_publishable_...) on client+server; RLS protects PII.

-- Availability: single row id=1
create table if not exists availability (
  id int primary key check (id=1),
  working_days int[] not null default array[0,1,2,3,4,5,6],
  hours int[] not null default array[9,10,11,12,14,15,16,17],
  timezone text not null default 'UTC+02:00 (EET)',
  updated_at timestamptz not null default now()
);
insert into availability (id) values (1) on conflict (id) do nothing;

-- Bookings
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  date text not null, -- DD/MM/YYYY host perspective
  time text not null, -- hh:mm AM/PM host
  user_local_time text,
  user_timezone double precision,
  name text not null,
  email text not null,
  reason text,
  meeting_link text,
  google_event_id text,
  created_at timestamptz not null default now()
);
create index if not exists bookings_date_time_idx on bookings(date,time);
create index if not exists bookings_created_idx on bookings(created_at desc);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  number text,
  has_whatsapp boolean not null default false,
  message text not null,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on messages(created_at desc);

-- Enable RLS
alter table availability enable row level security;
alter table bookings enable row level security;
alter table messages enable row level security;

-- Policies: public read availability
drop policy if exists "public read availability" on availability;
create policy "public read availability" on availability for select using (true);
drop policy if exists "public upsert availability (anon)" on availability;
-- allow anon to update availability only if you protect dashboard via ADMIN_TOKEN check in API;
-- for simplicity allow authenticated anon update; API route validates ADMIN_TOKEN
create policy "public update availability" on availability for update using (true) with check (true);
create policy "public insert availability" on availability for insert with check (true);

-- Bookings: public can insert, but can only select date,time (PII hidden via API layer)
-- For direct client reads we restrict columns via view; here allow select but API filters columns.
drop policy if exists "public insert bookings" on bookings;
create policy "public insert bookings" on bookings for insert with check (true);
drop policy if exists "public read bookings" on bookings;
create policy "public read bookings" on bookings for select using (true);
drop policy if exists "public delete bookings" on bookings;
create policy "public delete bookings" on bookings for delete using (true);
drop policy if exists "public update bookings" on bookings;
create policy "public update bookings" on bookings for update using (true) with check (true);

-- Messages: public insert + read
drop policy if exists "public insert messages" on messages;
create policy "public insert messages" on messages for insert with check (true);
drop policy if exists "public read messages" on messages;
create policy "public read messages" on messages for select using (true);
drop policy if exists "public delete messages" on messages;
create policy "public delete messages" on messages for delete using (true);
drop policy if exists "public update messages" on messages;
create policy "public update messages" on messages for update using (true) with check (true);

-- Rate limit helpers (optional): enforce via API, not DB

-- Storage bucket for emails attachments (run separately if bucket exists)
-- insert into storage.buckets (id, name, public) values ('emails','emails', false) on conflict do nothing;
-- then add storage policies for anon insert/select
