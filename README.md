# Mohand Darwish — Portfolio

> Personal portfolio of **Mohand Darwish**, Software Engineer (Full-Stack, Frontend-leaning) based in Alexandria, Egypt.
> Clean architecture, performant web apps, and systems that scale — built with **Next.js + TypeScript + Node**.

**Live:** https://mohand-darwish.dev

---

## Overview

This is not a static one-pager. It's a full product:

- **Marketing site** — hero, projects showcase, about, contact, project detail pages, CV modal
- **Booking system** — visitors can book a call (availability + booked-slots APIs, email receipts)
- **Contact pipeline** — contact form → validation/sanitization → Supabase + email via Resend
- **Owner dashboard (`/dashboard`)** — CMS for projects, tags, contributors, experience, inbox/messages, bookings, site settings, hero images, analytics
- **Analytics & tracking** — project views, dashboard charts (Recharts), Vercel Analytics

## Pages & Sections

| Route | What it is |
|---|---|
| `/` | Single-page flow: Hero → Projects → About → Contact (full-viewport pager with curtain/slide transitions, scroll reveal) |
| `/projects` | Filterable project listing (Frontend / Full-Stack / Design System / Tooling) |
| `/projects/[id]` | Project detail: gallery, videos, stack tags, contributors, metrics, live/GitHub/download links, view tracking |
| `/about` | Full story: Experience / Education / Skills / Stack tabs |
| `/mohanddarwish` | Vanity / short-link profile route |
| `/dashboard` | Private owner CMS (token-gated): projects, tags, contributors, messages, bookings, settings, treasury, LLM assistant |
| `/api/*` | Backend: `contact`, `booking`, `booked-slots`, `availability`, `messages`, `track`, `dashboard/*`, `diag` |

### Home sections

1. **Hero** — animated split-text intro, morphing portrait (light/dark aware, dashboard-overridable), `Book a call` + `View projects` CTAs, location badge
2. **Projects** — featured carousel/grid driven by Supabase (`listing` order), live data with static fallback
3. **About** — sticky intro + WAI-APG accessible tabs (Experience / Education / Skills / interactive Stack playground)
4. **Contact** — contact card + booking entry point, validated form with spam protection

## Key Features

- **Project showcase CMS-driven** — projects, tags (with color + icon), contributors (with socials), images/videos all edited in the dashboard, mapped via `Data/projects.ts` (`mapDashboardDocToProject`)
- **Booking flow** — `BookButton` → `BookingModal` → custom time picker → `POST /api/booking` → availability check → Resend receipt to visitor + notification to owner → sync to dashboard
- **Contact flow** — `POST /api/contact` with sanitization (`lib/sanitize.ts`), rate-limit friendly, stored in Supabase, emailed via Resend (`lib/email.ts`, `lib/replyEmail.ts`, `lib/receipt.ts`)
- **Dashboard CMS** — token auth (`lib/dash-auth.ts`), Firestore-style `lib/dash-db.ts` wrapper, modules: Projects, Tags, Contributors, Developer profile, Messages/Inbox, Bookings, Settings/Account, Treasury, Trails, MCP, Canary checks, AI Assistant (`/api/dashboard/llm`)
- **Theming** — `next-themes` dark (default, black `#0A0A0A` + wine/mahogany) / light (warm paper `#FAF6F0`), AA-checked contrast, theme-aware hero images
- **Motion** — GSAP + Motion + Lenis smooth scroll, section pager (`components/transitions`), portrait morph, tab pill, scroll reveals; `prefers-reduced-motion` respected
- **SEO** — dynamic metadata (`lib/metadata.ts`), OG images, `sitemap.ts` (includes Supabase projects), `robots.ts`, semantic HTML
- **CV modal** — in-app CV viewer (`components/cv/CvModal`), downloadable `/cv.pdf` from `public/`

## Tech Stack

| Layer | Tools |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4, CSS variables design tokens (`app/globals.css`) |
| Fonts | Space Grotesk (display), IBM Plex Mono (nav/code/labels), Inter (body) via `next/font` |
| Motion | GSAP, Motion (`motion`), Lenis, animejs, OGL / matter-js playgrounds |
| Backend / Data | Supabase (`@supabase/supabase-js`), dashboard DB layer in `lib/dash-*` |
| Email | Resend (`resend`) |
| Analytics / Charts | Vercel Analytics, Recharts |
| Content | react-markdown + remark-gfm (dashboard markdown) |
| Misc | next-themes, react-easy-crop (image upload), lucide-react icons |

See `DESIGN.md` for the full design system (palette, type scale, components, do/don'ts).

## Project Structure

```
app/                  # App Router: page.tsx, layout.tsx, about/, projects/, dashboard/,
                      # mohanddarwish/, api/ (contact, booking, messages, track, dashboard/*)
components/
  hero/               # HeroSection, TextAnimated, portrait-morph
  projects/           # ProjectsSection, cards, detail views
  about/              # AboutSection + experience/education/skills/stack tabs
  booking/            # BookButton, BookingModal, CustomTimePicker
  contact/            # contact-card + form
  dashboard/          # CMS modules (D-*, M-*) + Assistant
  cv/                 # CV modal
  layouts/            # nav, providers (theme), path-memory, modal-viewport
  ui/                 # button, card, badge, motion-primitives
  transitions/        # SectionTransition, SectionSlide, ScrollReveal, RouteCurtain
Data/                 # me.ts (profile/socials), projects.ts (types + dashboard mapping)
lib/                  # supabase client/server, booking, availability, email/resend,
                      # receipt, metadata, analytics-types, dash-*
hooks/ utils/ types/  # shared client logic
supabase/             # schema.sql, dashboard-schema.sql
public/               # cv.pdf, me/* portraits, svgs/, site.webmanifest
apps-script/          # companion Google Apps Script (if used for sheets/mail sync)
DESIGN.md             # design system source of truth
```

## Getting Started

**Prerequisites:** Node 20+, npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

## Environment Variables

Create `.env.local` (never commit it):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
RESEND_API_KEY=...
OWNER_EMAIL=...
ADMIN_TOKEN=...
```

| Var | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public project + dashboard reads (`lib/supabase/*`) |
| `RESEND_API_KEY` | Contact/booking/reply emails (`lib/resend.ts`) |
| `OWNER_EMAIL` | Booking/contact notification recipient |
| `ADMIN_TOKEN` | Gates `/dashboard` and `app/api/dashboard/*` (`lib/dash-auth.ts`) |

Database setup:

```bash
# in Supabase SQL editor, run in order:
supabase/schema.sql
supabase/dashboard-schema.sql
```

## Design System

Single source of truth: [`DESIGN.md`](./DESIGN.md) + tokens in `app/globals.css`.

- Dark: black `#0A0A0A` base + wine/mahogany system (`#250902`, `#38040E`, `#640D14`, `#800E13`, `#AD2831`)
- Light: warm paper `#FAF6F0` + wine text
- Brutalist-editorial: hairline grid borders, 0–8px radius, Space Grotesk + IBM Plex Mono + Inter
- Glass only for floating nav / modal backdrop / dropdowns — never cards or hero

## Deployment

Optimized for **Vercel**:

1. Push to GitHub, import into Vercel
2. Set the env vars above in Project Settings
3. Deploy — Next.js build handles AVIF/WebP image optimization, sitemap, and analytics automatically

Image remote hosts are allowlisted in `next.config.ts` (picsum, simpleicons, svgl, `*.supabase.co`).

## Author

**Mohand Darwish** — Alexandria, Egypt (GMT+2)

- Email: mohandamged70m@gmail.com
- LinkedIn: https://www.linkedin.com/in/mohand-darwish
- GitHub: https://github.com/mohandamged70m
- X: https://x.com/mohand_darwish

Available for new opportunities — hire CTA and `Book a call` are built into the hero.
