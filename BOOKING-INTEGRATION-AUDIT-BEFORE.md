# Booking Integration Audit — BEFORE

**Date:** Sat Oct 24 2026  
**Branch:** `feat/integrate-booking-system` (created from clean `main`)  
**Working tree:** `booking-system/` tracked; everything else clean

---

## 1. Git state

```
On branch feat/integrate-booking-system
Untracked files:
  BOOKING-INTEGRATION-AUDIT-BEFORE.md

Changes to be committed:
  booking-system/  (entire folder, previously untracked)
```

`booking-system/` was previously untracked and is now staged (A). No other files modified.  
`main` is clean and up to date with origin/main.

Last commits on `main`:
- `143408c` SEO: use 576x576 favicon
- `50aff4d` SEO: remove Vercel site-name leak
- `2490ba5` feat(developer): widen contribution calendar
- `128b748` feat(developer): show full 2026 calendar
- `06e9d7c` fix(developer): mirror GitHub contribution calendar

---

## 2. Main app (`/`) — existing booking implementation (Convex stack, NO Firebase)

| Area | Files |
|------|-------|
| UI (client modal) | `components/booking/BookingModal.tsx`, `components/booking/BookingHashHandler.tsx`, `components/booking/CustomTimePicker.tsx` |
| UI transitions | `components/transitions/booking/{booking-variants.ts,BookingShell.tsx,index.ts}` |
| API routes | `app/api/booking/route.ts` (+`[id]/`), `app/api/booked-slots/route.ts`, `app/api/availability/route.ts` |
| Convex backend | `convex/bookings.ts`, `convex/availability.ts`, `convex/rateLimits.ts` |
| Convex schema | `convex/schema.ts` (tables: `bookings`, `availability`, `dashboardDocs`, ...) |
| Lib | `lib/availability.ts`, `lib/booking.ts`, `lib/timezones.ts`, `lib/validate.ts`, `lib/sanitize.ts`, `lib/rate-limit.ts`, `lib/email.ts`, `lib/resend.ts` |
| UI kit | `components/ui/{alert,hint-tooltip,mohand-select,button,badge,glassy-button,motion-primitives}.tsx` |
| Hooks | `hooks/useSafeAlert.ts`, `hooks/useTheme.ts` |
| Dashboard | `app/dashboard/page.tsx`, `app/dashboard/dashboard-client.tsx`, `components/dashboard/` |
| Auth | NextAuth (`next-auth`), owner-only dashboard |

Key characteristics:
- Backend: **Convex** (no Firebase). `bookings` + `availability` tables; `dashboardDocs` emulates Firestore `Settings/*` docs.
- Email: **Resend**
- Slots: 1-hour grid from `availability` table; booked slots via `booked-slots` API
- Booking flow: `/api/booking` POST → Convex `bookings.create` → Apps Script `MEETING_SYNC_URL` → Resend emails
- Path alias: `@/` → repo root
- Footer already links `#booking` ("Book a call") → opens existing `BookingModal` via hash handler

---

## 3. `booking-system/` — standalone booking app (Firebase stack) — TRACKED, NOT integrated yet

Complete Next.js 16.2.12 app, Firebase + Cloud Functions. Contains the richer booking UI (15-min grid calendar, custom-time picker, timezone conversion, booking rules engine, paint kit) but is **Firebase-dependent** — must be adapted to Convex before merging into the main app.

Notable extracted logic (pure, no Firebase):
- `src/utils/bookingRules.ts` — 45-day window, 30-min buffer, 15-min grid, overlap rejection
- `src/utils/timezones.ts` — UTC offset picker options
- `src/utils/availability.ts` — parseAvailabilityConfig, availabilityStatus
- `src/utils/bookPage.ts` — page content parsing
- `src/hooks/useMeetingBooking.ts` — calendar state, slot generation, submit (currently Firebase callable)

---

## 4. Stack divergence

| | Main app | `booking-system/` |
|---|----------|-------------------|
| Backend | Convex + NextAuth | Firebase + Cloud Functions |
| Reads | `/api/availability`, `/api/booked-slots` (Convex) | Firestore REST (`lib/liveDoc`) |
| Submit | POST `/api/booking` (Convex) | `httpsCallable(bookMeeting)` (Firebase) |
| Path alias | `@/` | relative imports |
| Booking UI | `components/booking/BookingModal` (contact modal) | `src/app/book/` (dedicated `/book` page) |

---

## 5. Integration plan (Convex, no Firebase)

1. Keep `booking-system/` tracked as the extracted source reference.
2. Extract pure logic into main app `lib/`: `booking-rules.ts` (from `booking-system/src/utils/bookingRules.ts`), `booking-availability.ts`, `booking-timezones.ts`.
3. Create `hooks/useMeetingBooking.ts` adapted to POST `/api/booking` + read `/api/availability` + `/api/booked-slots` (Convex).
4. Create `components/booking-system/` with `BookPage.tsx`, `paintKit.tsx`, `brushes.ts`, `useBookTrail.ts`, `book.css` + lazy UI (Alert, Select, CustomTimePicker, HintTooltip).
5. Create `app/book/page.tsx` + `app/book/layout.tsx` (client-only page, metadata + JSON-LD).
6. Copy snapshot data: `data/book.snapshot.json`, `data/availability.snapshot.json`.
7. Wire footer `/book` link.
8. Run typecheck/lint where feasible.
9. Produce **AFTER** audit (`git diff --stat` + summary).
