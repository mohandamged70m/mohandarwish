# Mohand Darwish — Portfolio

> Personal portfolio of **Mohand Darwish**, Software Engineer | AI Product Builder based in Alexandria, Egypt.
> Clean architecture, performant web apps, and systems that scale — built with **Next.js + TypeScript + Node**.

**Live:** https://mohanddarwish.vercel.app/

---

## Overview

Personal portfolio with a private dashboard for managing content:

- **Marketing site** — hero, projects showcase, stack, contact, project detail pages, CV modal
- **Booking system** — visitors can book a call (availability + booked-slots APIs, email receipts)
- **Contact pipeline** — contact form → validation/sanitization → Convex + email via Resend
- **Owner dashboard (`/dashboard`)** — CMS for projects, tags, contributors, experience, inbox/messages, bookings, site settings, hero images, analytics
- **Treasury** — finance tracking (projects, income, expenses, accounts, receipts); no client accounts
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
- **Dashboard CMS** — Auth.js Google sign-in restricted to the owner Gmail (`auth.ts`, `lib/owner.ts`, `lib/admin.ts`), Firestore-style `lib/dash-db.ts` wrapper, modules: Projects, Tags, Contributors, Developer profile, Messages/Inbox, Bookings, Settings/Account, Treasury, Trails, MCP, Canary checks, AI Assistant (`/api/dashboard/llm`)
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
DASHBOARD_OWNER_EMAIL=...
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
CONVEX_SERVER_KEY=...
```

| Var | Used for | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL; requests go through Next.js gateways | Convex dashboard → Settings → URL |
| `RESEND_API_KEY` | Contact/booking/reply emails (`lib/resend.ts`) | Resend dashboard → API keys |
| `OWNER_EMAIL` | Booking/contact notification recipient | Your inbox address |
| `DASHBOARD_OWNER_EMAIL` | The ONLY Gmail allowed into `/dashboard` (case-insensitive, verified claim required) | Your Gmail address |
| `AUTH_SECRET` | Encrypts Auth.js sessions (≥32 chars); rotating signs everyone out | Generated: `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client for “Sign in with Google” | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application) |
| `RATE_LIMIT_SECRET` | Optional; hashes visitor addresses for rate limits (falls back to `AUTH_SECRET`) | Generated like `AUTH_SECRET` |
| `CONVEX_SERVER_KEY` | Server-only secret, identical in Next.js and Convex deployment environments | Generated; `npx convex env set CONVEX_SERVER_KEY` |
| `MEETING_SYNC_URL` | Optional Apps Script calendar integration | Your Apps Script deployment URL |
| `RESEND_FROM` | Verified email sender | Your verified Resend domain |

### Google OAuth setup (one-time, in your Google Cloud project)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create Credentials → OAuth client ID → Application type **Web application**.
2. Under **Authorized redirect URIs** add exactly:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://<your-production-domain>/api/auth/callback/google` (e.g. `https://mohanddarwish.vercel.app/api/auth/callback/google`)
3. Copy the Client ID → `AUTH_GOOGLE_ID` and Client secret → `AUTH_GOOGLE_SECRET` in `.env.local` (local) and Vercel Project Settings → Environment Variables (Preview + Production).
4. Set `DASHBOARD_OWNER_EMAIL` to your Gmail and `AUTH_SECRET` to `npx auth secret` output in the same places. Never commit real values — `.env.example` holds placeholders only.

Copy `.env.example` before deploying.

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
2. Configure both Next.js and Convex env vars (see Environment Variables above)
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
