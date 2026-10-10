# Mohand Darwish — Portfolio

> Personal portfolio of **Mohand Darwish**, Software Engineer | AI Product Builder based in Alexandria, Egypt.
> Clean architecture, performant web apps, and systems that scale — built with **Next.js + TypeScript + Node**.

**Live:** https://mohanddarwish.vercel.app/

---

## Overview

Personal portfolio with a private workspace for managing content and client work:

- **Marketing site** — hero, projects showcase, stack, contact, project detail pages, CV modal
- **Booking system** — visitors can book a call (availability + booked-slots APIs, email receipts)
- **Contact pipeline** — contact form → validation/sanitization → Convex + email via Resend
- **Owner dashboard (`/dashboard`)** — CMS for projects, tags, contributors, experience, inbox/messages, bookings, site settings, hero images, analytics
- **Private workspace** — lead pipeline, client projects, milestones, invoice status and internal notes; no client accounts
- **Analytics & tracking** — project views, dashboard charts (Recharts), Vercel Analytics

## Pages & Sections

| Route | What it is |
|---|---|
| `/` | Single-page flow: Hero → Projects → Stack → Contact (full-viewport pager with curtain/slide transitions, scroll reveal) |
| `/projects` | Filterable project listing (Frontend / Full-Stack / Design System / Tooling) |
| `/projects/[id]` | Project detail: gallery, videos, stack tags, contributors, metrics, live/GitHub/download links, view tracking |
| `/mohanddarwish` | Vanity / short-link profile route |
| `/dashboard` | Private owner CMS (signed HttpOnly session): projects, tags, contributors, messages, bookings, settings, treasury, LLM assistant |
| `/api/*` | Backend: `contact`, `booking`, `booked-slots`, `availability`, `messages`, `track`, `dashboard/*`, `diag` |

### Home sections

1. **Hero** — animated split-text intro, morphing portrait (light/dark aware, dashboard-overridable), `Book a call` + `View projects` CTAs, location badge
2. **Projects** — featured carousel/grid driven by Convex (`listing` order), live data with static fallback
3. **Stack** — sticky intro + interactive Stack playground (Matter.js, dashboard-driven)
4. **Contact** — contact card + booking entry point, validated form with spam protection

## Key Features

- **Project showcase CMS-driven** — projects, tags (with color + icon), contributors (with socials), images/videos all edited in the dashboard, mapped via `data/projects.ts` (`mapDashboardDocToProject`)
- **Booking flow** — `BookButton` → `BookingModal` → custom time picker → `POST /api/booking` → availability check → Resend receipt to visitor + notification to owner → sync to dashboard
- **Contact flow** — `POST /api/contact` with sanitization (`lib/sanitize.ts`), rate-limit friendly, stored in Convex, emailed via Resend (`lib/email.ts`, `lib/replyEmail.ts`, `lib/receipt.ts`)
- **Dashboard CMS** — signed owner session (`lib/session.ts`, `lib/dash-auth.ts`), Firestore-style `lib/dash-db.ts` wrapper, modules: Projects, Tags, Contributors, Developer profile, Messages/Inbox, Bookings, Settings/Account, Treasury, Trails, MCP, Canary checks, AI Assistant (`/api/dashboard/llm`)
- **Theming** — `next-themes` dark (default, black `#0A0A0A` + wine/mahogany) / light (warm paper `#FAF6F0`), AA-checked contrast, theme-aware hero images
- **Motion** — GSAP + Motion + Lenis smooth scroll, section pager (`components/transitions`), portrait morph, tab pill, scroll reveals; `prefers-reduced-motion` respected
- **SEO** — dynamic metadata (`lib/metadata.ts`), OG images, `sitemap.ts` (includes Convex projects), `robots.ts`, semantic HTML
- **CV modal** — in-app CV viewer (`components/cv/CvModal`), downloadable `/cv.pdf` from `public/`

## Tech Stack

| Layer | Tools |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4, CSS variables design tokens (`app/globals.css`) |
| Fonts | Space Grotesk (display), IBM Plex Mono (nav/code/labels), Inter (body) via `next/font` |
| Motion | GSAP, Motion (`motion`), Lenis, animejs, OGL / matter-js playgrounds |
| Backend / Data | Convex, dashboard DB layer in `lib/dash-*` |
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
  sections/           # landing sections (each with index.ts barrel):
    hero/             # HeroSection, TextAnimated, PortraitMorph
    projects/         # ProjectsSection, cards, detail views, DeveloperTab
    stack/            # StackSection + interactive Stack playground (Matter.js)
    developer/        # Developer profile, GitHub stats/graphs, repos
  booking/            # BookButton, BookingModal, CustomTimePicker
  dashboard/          # CMS modules (D-*, M-*) + Assistant + primitives/
  cv/                 # CV modal
  layout/             # nav, providers (theme), path-memory, modal-viewport
  ui/                 # button, badge, alert, selects, motion-primitives
  transitions/        # SectionTransition, SectionSlide, ScrollReveal, RouteCurtain
data/                 # me.ts (profile/socials), projects.ts (types + dashboard mapping)
lib/                  # convex client helpers, booking, availability, categories,
                      # timezones, email/resend, receipt, metadata, dash-*
hooks/ types/         # shared client logic (hooks/ has index.ts barrel)
convex/                # schema + functions (docs, bookings, messages, profile, storage)
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
| `npm run typecheck` | TypeScript |
| `npm run test` | Security, persistence and route tests |
| `npm run test:e2e` | Chromium browser checks (build first) |

## Environment Variables

Create `.env.local` (never commit it):

```bash
NEXT_PUBLIC_CONVEX_URL=...
RESEND_API_KEY=...
OWNER_EMAIL=...
ADMIN_TOKEN=...
SESSION_SECRET=...
CONVEX_SERVER_KEY=...
```

| Var | Used for |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL; requests go through Next.js gateways |
| `RESEND_API_KEY` | Contact/booking/reply emails (`lib/resend.ts`) |
| `OWNER_EMAIL` | Booking/contact notification recipient |
| `ADMIN_TOKEN` | Owner credential exchanged for a 24-hour signed session; never persisted in browser storage |
| `SESSION_SECRET` | Server-only random secret (at least 32 characters) for owner sessions and rate-limit keys |
| `CONVEX_SERVER_KEY` | Server-only secret, identical in Next.js and Convex deployment environments |
| `MEETING_SYNC_URL` | Optional Apps Script calendar integration |
| `RESEND_FROM` | Verified email sender |

Copy `.env.example` and read [OWNER_WORKSPACE.md](./OWNER_WORKSPACE.md) before deploying.

Database setup:

```bash
# Convex dev/codegen + functions are deployed by:
npx convex dev
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
2. Follow [OWNER_WORKSPACE.md](./OWNER_WORKSPACE.md) to configure both Next.js and Convex
3. Validate a preview before coordinating the backend and app deployment

Image remote hosts are allowlisted in `next.config.ts` (picsum, simpleicons, svgl, Convex storage).

## Author

**Mohand Darwish** — Alexandria, Egypt (GMT+2)

- Email: mohandamged70m@gmail.com
- LinkedIn: https://www.linkedin.com/in/mohandamged
- GitHub: https://github.com/mohandamged70m
- YouTube: https://www.youtube.com/@mohand.darwish
- X: https://x.com/mohand_darwish

Available for new opportunities — hire CTA and `Book a call` are built into the hero.
