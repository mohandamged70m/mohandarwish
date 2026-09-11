-- Profile content for /about (skills, experience, stack, education).
-- Run in Supabase SQL Editor AFTER schema.sql.
-- Public site reads visible rows ordered by sort_order.
-- Writes go through Next API routes guarded by ADMIN_TOKEN (lib/admin.ts),
-- same pattern as bookings/messages.

-- ── Experience ──
create table if not exists profile_experience (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  role text not null,
  period text not null,
  start_date date,
  end_date date,
  slug text,
  brand text,
  location text,
  description text,
  link text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profile_experience_order_idx on profile_experience(sort_order, created_at);

-- ── Education ──
create table if not exists profile_education (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  degree text not null,
  period text not null,
  start_date date,
  end_date date,
  slug text,
  link text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profile_education_order_idx on profile_education(sort_order, created_at);

-- ── Skills ──
create table if not exists profile_skills (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profile_skills_order_idx on profile_skills(sort_order, created_at);

-- ── Stack ──
create table if not exists profile_stack (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null,
  bg text not null default '#1f1f1f',
  fg text not null default '#ffffff',
  icon_url text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profile_stack_order_idx on profile_stack(sort_order, created_at);

-- ── RLS ──
alter table profile_experience enable row level security;
alter table profile_education enable row level security;
alter table profile_skills enable row level security;
alter table profile_stack enable row level security;

drop policy if exists "public read profile_experience" on profile_experience;
create policy "public read profile_experience" on profile_experience for select using (true);
drop policy if exists "public write profile_experience" on profile_experience;
create policy "public write profile_experience" on profile_experience for insert with check (true);
drop policy if exists "public update profile_experience" on profile_experience;
create policy "public update profile_experience" on profile_experience for update using (true) with check (true);
drop policy if exists "public delete profile_experience" on profile_experience;
create policy "public delete profile_experience" on profile_experience for delete using (true);

drop policy if exists "public read profile_education" on profile_education;
create policy "public read profile_education" on profile_education for select using (true);
drop policy if exists "public write profile_education" on profile_education;
create policy "public write profile_education" on profile_education for insert with check (true);
drop policy if exists "public update profile_education" on profile_education;
create policy "public update profile_education" on profile_education for update using (true) with check (true);
drop policy if exists "public delete profile_education" on profile_education;
create policy "public delete profile_education" on profile_education for delete using (true);

drop policy if exists "public read profile_skills" on profile_skills;
create policy "public read profile_skills" on profile_skills for select using (true);
drop policy if exists "public write profile_skills" on profile_skills;
create policy "public write profile_skills" on profile_skills for insert with check (true);
drop policy if exists "public update profile_skills" on profile_skills;
create policy "public update profile_skills" on profile_skills for update using (true) with check (true);
drop policy if exists "public delete profile_skills" on profile_skills;
create policy "public delete profile_skills" on profile_skills for delete using (true);

drop policy if exists "public read profile_stack" on profile_stack;
create policy "public read profile_stack" on profile_stack for select using (true);
drop policy if exists "public write profile_stack" on profile_stack;
create policy "public write profile_stack" on profile_stack for insert with check (true);
drop policy if exists "public update profile_stack" on profile_stack;
create policy "public update profile_stack" on profile_stack for update using (true) with check (true);
drop policy if exists "public delete profile_stack" on profile_stack;
create policy "public delete profile_stack" on profile_stack for delete using (true);

-- ── Seed from current hardcoded About content (idempotent) ──
insert into profile_experience (company, role, period, slug, brand, sort_order) values
  ('Freelance', 'Frontend Engineer (Full-Stack)', 'Jan 2023 – Present', null, '#AD2831', 0),
  ('Open Source', 'Contributor — Design System & Tooling', 'Jun 2022 – Present', 'github', '#111111', 1),
  ('Studio Intern', 'Frontend Intern', 'Jun 2021 – May 2022', null, '#1F1F1F', 2)
on conflict do nothing;

insert into profile_education (school, degree, period, sort_order) values
  ('Alexandria University', 'B.Sc. Computer Engineering — Frontend & Systems focus', '2019 – 2023', 0),
  ('ALX / Holberton', 'Advanced Frontend & Backend (React, Node)', '2022 – 2023', 1),
  ('Continuous Learning', 'Web Performance, A11y & Design Systems', '2023 – Present', 2)
on conflict do nothing;

insert into profile_skills (label, sort_order) values
  ('React / Next.js', 0),
  ('TypeScript', 1),
  ('Tailwind / Storybook', 2),
  ('Node / tRPC / Prisma', 3),
  ('Performance & Web Vitals', 4),
  ('Accessibility (a11y)', 5),
  ('Testing (Playwright / Vitest)', 6),
  ('System Design', 7),
  ('Design Systems', 8)
on conflict (label) do nothing;

insert into profile_stack (label, slug, bg, fg, icon_url, sort_order) values
  ('Figma', 'figma', '#1f1f1f', '#ffffff', 'https://svgl.app/library/figma.svg', 0),
  ('React', 'react', '#1FB6CB', '#ffffff', null, 1),
  ('Next.js', 'nextdotjs', '#1f1f1f', '#ffffff', null, 2),
  ('TypeScript', 'typescript', '#2F74C0', '#ffffff', null, 3),
  ('shadcn/ui', 'shadcnui', '#5b54ff', '#ffffff', null, 4),
  ('Cursor', 'cursor', '#111111', '#ffffff', null, 5),
  ('GSAP', 'gsap', '#0AE448', '#0a0a0a', null, 6),
  ('GitHub', 'github', '#181717', '#ffffff', null, 7),
  ('Vercel', 'vercel', '#0a0a0a', '#ffffff', null, 8),
  ('Tailwind CSS', 'tailwindcss', '#2BBCF5', '#ffffff', null, 9)
on conflict do nothing;
