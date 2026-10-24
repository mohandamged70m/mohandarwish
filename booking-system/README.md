# Booking System

Extracted from the Revil portfolio (`revil-main`). This folder contains every piece of code that makes up the booking system: the public booking page, the contact-modal booking flow, the Cloud Functions backend, the admin dashboard, and the shared booking rules engine.

## What's included

### 1. Public booking page (`/book`)
| File | Purpose |
|------|---------|
| `src/app/book/page.tsx` | Next.js route for `/book` — client-only booking page with a `<noscript>` fallback |
| `src/app/book/layout.tsx` | Page metadata (SEO, Open Graph, JSON-LD `ScheduleAction`) |
| `src/components/book/BookPage.tsx` | Main booking UI: hero, calendar, time slots, guest form, success state |
| `src/components/book/book.css` | Scoped styles under `.bp` (light + dark variants) |
| `src/components/book/brushes.ts` | Animated SVG dry-brush hero paint |
| `src/components/book/paintKit.tsx` | SVG filters, owner's live clock, `usePaint`, `useHostClock` |
| `src/components/book/useBookTrail.ts` | Analytics trail for `/book` visits |
| `src/data/book.snapshot.json` | Build-time fallback for page content + account links |

### 2. Booking logic (shared by page + contact modal + backend)
| File | Purpose |
|------|---------|
| `src/hooks/useMeetingBooking.ts` | **Core hook**: calendar state, timezone handling, slot generation, submit to `bookMeeting` function, custom-time validation |
| `src/utils/bookingRules.ts` | **Single source of truth** for booking rules: working days/hours, booking window (45 days), 30-min buffer, 15-min grid, overlap rejection |
| `src/utils/availability.ts` | Availability parsing, hour formatting, status pill (Available/Handled/Busy) |
| `src/utils/timezones.ts` | UTC offset picker options |
| `src/utils/categories.ts` | Meeting categories (Personal default + owner-defined buckets) |
| `src/data/availability.snapshot.json` | Build-time fallback for host availability/timezone |

### 3. Contact modal (with booking tab)
| File | Purpose |
|------|---------|
| `src/components/M-Contact.tsx` | Contact modal — message tab + meeting tab (shares `useMeetingBooking`) |
| `src/components/CustomTimePicker.tsx` | Free-form time picker (Hour/Minute/Period) reused by `/book` and Canary |
| `src/components/DatePicker.tsx` | Portaled calendar date picker |
| `src/components/Select.tsx` | Glassy select dropdown |
| `src/components/Alert.tsx` | Toast alert component |
| `src/hooks/useSafeAlert.tsx` | Toast alert hook with dedup |
| `src/lib/modalMotion.ts` | Blur-fade animation for modals |

### 4. Admin dashboard
| File | Purpose |
|------|---------|
| `src/components/dashboard/D-Canary.tsx` | Canary inbox: bookings list, reschedule/cancel, working-hours editor, categories |
| `src/components/dashboard/BookPageEditor.tsx` | Edit what `/book` says (slogan, intro, tags) |
| `src/components/dashboard/M-Receipt.tsx` | Receipt builder/preview/send modal |
| `src/components/dashboard/D-Settings.tsx` | Settings: Availability tab (timezone + availability %) |
| `src/components/dashboard/M-ConfirmModal.tsx` | Confirmation dialog |

### 5. Cloud Functions backend
| File | Purpose |
|------|---------|
| `functions/src/index.ts` | `bookMeeting` (validates, rate-limits, creates Calendar event + Meet link, records meeting), `notifyCanary` (emails + mirrors BookedSlots), `submitContact`, `cleanupAttachments`, `sendReceipt` |
| `functions/src/booking.ts` | **Generated** copy of `src/utils/bookingRules.ts` — same rules enforced server-side |
| `functions/src/mcp.ts` | MCP server with booking tools: `list_bookings`, `add_booking`, `update_booking`, `cancel_booking`, `list_categories`, `get_availability`, `update_availability` |
| `functions/src/geoip.ts` | IP → country lookup (used for rate-limit IP hashing) |
| `functions/scripts/sync-booking-rules.mjs` | Copies `src/utils/bookingRules.ts` → `functions/src/booking.ts` (run on prebuild) |
| `functions/package.json` | Dependencies + `sync-booking-rules` script |
| `functions/data/geoip-meta.json` | GeoIP table metadata |

### 6. Firebase client lib
| File | Purpose |
|------|---------|
| `src/lib/liveDoc.ts` | Firestore REST reads (public pages avoid the 550KB SDK) |
| `src/lib/firebase.ts` | Firestore init with persistence |
| `src/lib/firebaseApp.ts` | Firebase app + App Check (reCAPTCHA Enterprise) |
| `src/lib/receipt.ts` | Receipt HTML builder |
| `src/lib/replyEmail.ts` | Reply email builder |
| `src/lib/html.ts` | HTML escaping |
| `src/lib/analytics/collector.ts` | Visit collector (Trails) |
| `src/lib/analytics/types.ts` | Analytics types + `BOOK_SECTION = 'book'` |

### 7. Types & config
| File | Purpose |
|------|---------|
| `src/types/index.ts` | Shared TypeScript interfaces |
| `firestore.rules` | Security rules (Canary admin-only, BookedSlots public-read) |
| `firestore.indexes.json` | Firestore indexes |
| `storage.rules` | Storage rules (email attachments) |
| `.env.example` | Environment variables (Firebase config, secrets) |
| `next.config.mjs` | Next.js config (static export) |
| `package.json` | Root dependencies |

## Architecture

```
Visitor opens /book or contact modal
        │
        ▼
useMeetingBooking reads Settings/Availability + Settings/BookedSlots (via REST, lib/liveDoc)
        │
        ├─► Calendar shows open days (booking window: 45 days, 30-min buffer)
        ├─► Visitor picks date + time (preset or custom 15-min grid)
        ├─► Visitor enters name, email, reason
        │
        ▼
handleMeetingSubmit → bookMeeting Cloud Function
        │
        ├─► Validates slot still free (isTaken + bookingRefusal)
        ├─► Rate-limits per IP (hashed) + site-wide cooldown
        ├─► POSTs to Google Apps Script (MEETING_SYNC_URL) → Calendar event + Meet link
        ├─► Records meeting in Settings/Canary (Admin SDK)
        └─► Returns Meet link to visitor
        │
        ▼
notifyCanary (Firestore trigger on Settings/Canary)
        ├─► Emails admin + hello@ inbox
        ├─► Auto-acknowledges guest
        └─► Mirrors {Date, Time} to Settings/BookedSlots (public, PII-free)
```

## How to use this in your portfolio

### Prerequisites
1. A Firebase project with Firestore, Storage, and Cloud Functions enabled.
2. A Google Apps Script deployed as a web app that creates/cancels/updates Calendar events with Meet links (the `syncMeeting` proxy). Its URL goes in `MEETING_SYNC_URL` secret.
3. Resend account for email (SMTP relay at `smtp.resend.com`).
4. Firebase App Check with reCAPTCHA Enterprise (enforced on public functions).

### Setup steps

**1. Install dependencies**
```bash
cd booking-system/functions
npm install
```

**2. Sync the booking rules** (keeps `functions/src/booking.ts` in sync with `src/utils/bookingRules.ts`)
```bash
npm run sync-booking-rules
# or in CI: npm run sync-booking-rules -- --check
```

**3. Set secrets** (never commit these)
```bash
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set MEETING_SYNC_URL
firebase functions:secrets:set LLM_API_KEY  # optional, for dashboard assistant
```

**4. Deploy functions**
```bash
firebase deploy --only functions:bookMeeting,functions:notifyCanary,functions:submitContact,functions:cleanupAttachments,functions:mcp
```

**5. Set Firestore security rules**
```bash
firebase deploy --only firestore:rules
```

**6. Set Storage rules**
```bash
firebase deploy --only storage
```

**7. Configure environment variables**
Copy `.env.example` to `.env.local` and fill in your Firebase web config.

**8. Mark the admin**
In Firebase Authentication, set the `admin: true` custom claim on your account:
```js
admin.auth().setCustomUserClaims(uid, { admin: true })
```
Or set `Settings/Account.uid` in Firestore to your UID.

### Key design decisions

- **One rule definition**: `src/utils/bookingRules.ts` is edited; `functions/src/booking.ts` is generated from it by `scripts/sync-booking-rules.mjs`. The page and the function always enforce identical rules.
- **Canary is admin-only**: Visitors can't write `Settings/Canary` directly. All bookings go through the `bookMeeting` callable, which validates and rate-limits.
- **BookedSlots is the public mirror**: `Settings/BookedSlots` holds only `{Date, Time}` per booking (no PII), mirrored by `notifyCanary`. The public calendar reads this, not Canary.
- **Timezones**: The owner's working days/hours are on their clock; slots are converted to the visitor's picked timezone. Stored as `DD/MM/YYYY` + `hh:mm AM/PM` in the host's wall clock.
- **Rate limits**: Booking: 3 per IP per day, 10 attempts per IP per day, 5-minute site-wide cooldown. Contact: 3 per IP per hour, 30-second site-wide cooldown.