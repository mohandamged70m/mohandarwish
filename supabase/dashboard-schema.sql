-- Dashboard backend for mohand-darwish (Supabase, ADMIN_TOKEN-guarded via API).
-- Run in Supabase SQL Editor AFTER schema.sql.
--
-- The copy-pasted dashboard/ components were written against Firebase
-- (Firestore docs + Storage + Auth + Cloud Functions). Firebase is gone:
--   Firestore docs  -> dashboard_docs table (path -> data), via lib/dash-db.ts
--   Storage bucket  -> Supabase Storage bucket "dash", via lib/dash-storage.ts
--   Auth            -> ADMIN_TOKEN session, via lib/dash-auth.ts
--   Cloud Functions -> Next API routes (sync-meeting, send-reply, send-receipt, llm)
--
-- Table writes from visitors (analytics pings) and reads/writes from the
-- dashboard go through the anon key, same pattern as schema.sql; the dashboard
-- UI itself stays behind ADMIN_TOKEN, and destructive dashboard routes check it.

-- ── Generic document store (one row per Firestore-style doc path) ──
-- e.g. Settings/Account, Treasury/projects, Analytics/Days/Items/2026-09-05
create table if not exists dashboard_docs (
  path text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists dashboard_docs_prefix_idx on dashboard_docs (path text_pattern_ops);

alter table dashboard_docs enable row level security;
drop policy if exists "public all dashboard_docs" on dashboard_docs;
create policy "public all dashboard_docs" on dashboard_docs for all using (true) with check (true);

-- Live updates for the dashboard (lib/dash-db subscribes; falls back to
-- polling when replication is unavailable, so this is best-effort).
alter publication supabase_realtime add table dashboard_docs;

-- ── Storage bucket for dashboard uploads (project images, icons, receipts) ──
insert into storage.buckets (id, name, public)
values ('dash', 'dash', true)
on conflict (id) do update set public = true;

drop policy if exists "public read dash" on storage.objects;
create policy "public read dash" on storage.objects for select using (bucket_id = 'dash');
drop policy if exists "public write dash" on storage.objects;
create policy "public write dash" on storage.objects for insert with check (bucket_id = 'dash');
drop policy if exists "public update dash" on storage.objects;
create policy "public update dash" on storage.objects for update using (bucket_id = 'dash') with check (bucket_id = 'dash');
drop policy if exists "public delete dash" on storage.objects;
create policy "public delete dash" on storage.objects for delete using (bucket_id = 'dash');
