# Booking Integration Audit — AFTER

**Date:** Sat Oct 24 2026  
**Branch:** `feat/integrate-booking-system`  
**Base:** clean `main` (up to date with origin/main)

---

## 1. Git state (staged + unstaged)

```
Staged (booking-system/ extracted, previously untracked):
  booking-system/  (58 files — complete Firebase booking app, tracked as reference)

New files (integration, Convex-adapted):
  app/book/layout.tsx            — /book route metadata + JSON-LD (ScheduleAction)
  app/book/page.tsx              — /book client page, renders BookPage (ssr:false)
  components/booking-system/     — extracted UI, adapted to Convex (+no Firebase)
    BookPage.tsx, paintKit.tsx, brushes.ts, useBookTrail.ts, book.css
  lib/booking-rules.ts           — booking rules engine (45-day window, 30-min buffer,
                                   15-min grid, overlap rejection — pure logic)
  lib/booking-availability.ts    — parseAvailabilityConfig, availabilityStatus
  lib/booking-timezones.ts       — UTC offset picker + localCity detection
  lib/bookPage.ts                — page content parsing + linksFromAccount
  hooks/useMeetingBooking.ts     — calendar state + submit via POST /api/booking (Convex)
  data/book.snapshot.json        — seeded page content fallback
  data/availability.snapshot.json — seeded availability fallback

Modified:
  app/layout.tsx                 — footer "Book a call" now links to /book
  app/globals.css                — added --success, --blue, --paint-ink CSS variables

Untracked:
  BOOKING-INTEGRATION-AUDIT-BEFORE.md
  BOOKING-INTEGRATION-AUDIT-AFTER.md
```

---

## 2. What changed — before vs after

### Before (Convex booking, already in main app)
- Contact-modal booking via `components/booking/BookingModal` (hash `#booking`)
- 1-hour slot grid from `convex/availability.ts`
- `/api/booking` POST → Convex `bookings.create` → Apps Script → Resend
- No dedicated `/book` page; no 15-min grid; no timezone picker; no booking rules engine

### After (mined from `./booking-system`, adapted to Convex)
- **New `/book` page** with the booking-system's UI:
  - Animated SVG dry-brush hero (paintKit + brushes)
  - Calendar with 15-min preset grid + custom-time picker
  - Visitor timezone picker (auto-detected, named after their city)
  - 45-day booking window, 30-minute buffer, overlap rejection
  - Status pill (Available/Handled/Busy) + host live clock
  - Guest name/email/reason form → Google Meet link on success
- **Backend: Convex** (no Firebase):
  - Reads availability from `/api/availability` (Convex `availability` table)
  - Reads booked slots from `/api/booked-slots` (Convex `bookings` table)
  - Submits via POST `/api/booking` → Convex `bookings.create` → Apps Script → Resend
- **Shared rules engine** (`lib/booking-rules.ts`) used client-side for slot validation
- Footer "Book a call" now navigates to `/book` instead of opening the hash modal

---

## 3. Files by category

| Category | Files |
|----------|-------|
| Booking rules engine (pure, no Firebase) | `lib/booking-rules.ts` |
| Availability parsing | `lib/booking-availability.ts` |
| Timezone options + localCity | `lib/booking-timezones.ts` |
| Page content parsing + links | `lib/bookPage.ts` |
| Booking hook (Convex API) | `hooks/useMeetingBooking.ts` |
| BookPage UI (paint + calendar + form) | `components/booking-system/BookPage.tsx` |
| SVG brush animations | `components/booking-system/brushes.ts` |
| Paint engine (usePaint, useHostClock) | `components/booking-system/paintKit.tsx` |
| Trails hook (/book section) | `components/booking-system/useBookTrail.ts` |
| Component styles | `components/booking-system/book.css` |
| Route metadata + JSON-LD | `app/book/layout.tsx`, `app/book/page.tsx` |
| Snapshot data | `data/book.snapshot.json`, `data/availability.snapshot.json` |
| Extracted reference (Firebase) | `booking-system/` (58 files, untouched) |

---

## 4. What was NOT changed (intentional)

- **No Firebase installed.** The `firebase` package is NOT in the root `package.json`. The `/book` page reads via `/api/*` REST routes (Convex) and never imports `firebase/` or `firebase/functions`.
- **`booking-system/` left untouched.** It is tracked as a reference copy of the original Firebase booking app. No file inside it was modified.
- **Existing Convex booking modal preserved.** `components/booking/BookingModal` still works via `#booking` hash; the footer now points to `/book` instead.
- **Existing Convex backend unchanged.** `convex/bookings.ts`, `convex/availability.ts`, `convex/schema.ts`, `/api/booking`, `/api/availability`, `/api/booked-slots` are all untouched — the new `/book` page uses them as-is.
- **Firebase functions in `booking-system/functions/`** remain as-is (reference only, not deployed from this repo).

---

## 5. Verification

- `tsc --noEmit`: **zero errors** in any new integration file. (Pre-existing errors only in `booking-system/functions/`, which are Firebase-type errors unrelated to this integration.)
- `eslint`: **zero errors** in all new integration files. One warning: `` in BookPage (intentional — CSS mask-image cutout, same as booking-system).

---

## 6. Remaining setup (deploy-time)

To make bookings actually create Calendar events + Meet links:

1. **Convex env vars** (same as existing booking):
   - `MEETING_SYNC_URL` — Google Apps Script web-app URL
   - `RESEND_API_KEY`, `RESEND_FROM`, `OWNER_EMAIL` — notification emails

2. **`/book` cutout image**: `public/book/mohand-cutout.webp` (referenced by BookPage) — add your own cutout image.

3. **Dashboard content**: `Settings/BookPage` and `Settings/Account` docs in Convex `dashboardDocs` drive the slogan/intro/tags/links. Seeded from `data/book.snapshot.json` until set.

4. **Availability**: `Settings/Availability` in Convex `availability` table drives working days/hours/timezone. Seeded from `data/availability.snapshot.json`.
