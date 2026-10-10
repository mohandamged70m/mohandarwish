# TRAILS Implementation — Convex-native (phased)

Reference: `D-trails/` was empty at inspection (2026-10-11, branch
`feat/d-trails-editing`, tree clean, fetched `origin --prune`). There is no
extracted Firebase source to convert. This doc therefore maps the **existing
portfolio Trails implementation** against the 7-phase goal and records what is
done vs. what remains. No reference-owner content, credentials, domain, or mail
config is copied here.

Existing spec: `docs/D-TRAILS.md` (authoritative for semantics/honesty rules).

## Phase 1 — Inspect and map (DONE 2026-10-11)

### Actual code inspected

| Area | Files | Finding |
|---|---|---|
| Ingest gateway | `app/api/track/route.ts` | Validated gateway: bot reject, 90/min rate limit, owner from Auth.js session (never `body.owner`), transactional `trails.applyFlush`, best-effort notify + `outboxMarkBySession`. |
| Convex backend | `convex/trails.ts`, `convex/schema.ts`, `convex/access.ts`, `convex/docs.ts` | Single-transaction `applyFlush` (session + day/totals/sources/socials/link/project deltas + batch dedupe + outbox). `trailOutbox` is a typed table; everything else lives in generic `dashboardDocs` (`Analytics/*` path emulation). Auth = `CONVEX_SERVER_KEY` via server gateway (`lib/convex.ts`), never exposed to browser. |
| Tracking client | `lib/analytics/collect.ts`, `components/dashboard/TrailsTracker.tsx`, `lib/analytics/tailor.ts`, `lib/analytics/source.ts` | Immutable `{seq,batchId}` batches, serialized delivery, bounded backoff, 5-batch persisted outbox, hello-acked entry/device/UTM, idle/activity gating, link A→B restart, stale-attribution expiry, observer flap guard, `__trails.track` bridge for sections/projects/CV/social/contact/booking. |
| Dashboard UI | `components/dashboard/D-Trails.tsx`, `M-Story.tsx`, `M-ConfirmModal.tsx`, primitives | Stories / Overview / Links views, charts, rankings, filters, deep-link story park (`STORY_KEY`), 15s "reading now" clock. Reads via Firestore-compat shim (`lib/dash-db.ts` → `POST /api/data` → Convex), i.e. **polling snapshots, not Convex subscriptions**. |
| Links/personalize | `app/mohanddarwish/[code]/landing.tsx`, `page.tsx`, `app/api/share/[code]/route.ts` | Code resolve → sessionStorage handoff → tracker restart; tailor (greeting/pinned/Auto-CV). |
| Notifications | `app/api/dashboard/trails-outbox/route.ts`, `lib/email.ts`, `lib/resend.ts` | Inline send on `/api/track` + owner drain (GET backlog / POST bounded retry). Failure leaves row pending; visit never lost. |
| Tests | `tests/trails-ingest.test.ts`, `trails-links.test.ts`, `trails-source.test.ts`, `tests/browser/trails.spec.ts` | Ingest semantics, link ops, source classification, browser contract. |
| Deps | `package.json` | **No `firebase` dependency.** Only stale `firebase`/`firestore`/`Cloud Function` words in comments/strings (see Phase 6 list). No Firebase runtime in Trails. |

### Event producers (connected today)

Sections (IntersectionObserver), project open/close/outbound (click classify +
`nav`), demo/repo/download clicks, CV (`open-cv` + `data-track="cv"` + cv.pdf
href), social outbound + `social-back`, contact open (cooldown-guarded) /
tab / sent. `contact_sent` is **browser-reported** (`BookingModal` on
successful `/api/booking`|`/api/messages` persistence) — claimed, not
server-confirmed (known limit, labelled honestly in UI/docs).

### Firebase → Convex mapping

No Firebase imports, Firestore collections/listeners/writes, Storage calls,
Cloud Functions, or App Check assumptions exist in the Trails path. Every
historical Firebase operation already has a Convex destination:

| Firebase concept | Trails replacement (this repo) |
|---|---|
| Firestore collections (`Analytics/*`) | `dashboardDocs` rows (`Analytics/Sessions/Items/*`, `Days/*`, `Links/*`, `Sources/*`, `Socials/*`, `Totals`, `Tombstones/*`) + typed `trailOutbox` |
| `onSnapshot` listeners | `lib/dash-db.ts` polling snapshots over `POST /api/data` (functional; Phase 4 replaces with authenticated Convex subscriptions) |
| Client writes / Cloud Functions | `POST /api/track` → `trails.applyFlush` transaction; link ops `createLink`/`updateLink`/`deleteLink`/`deleteSession`/`forgetLinkVisits`/`pruneSessions`; notify via Resend inline + outbox drain |
| App Check | Replaced by: Auth.js owner session, `CONVEX_SERVER_KEY` server gate, per-IP rate limit, strict identity/batch validation, bot UA reject, payload caps |

### Gaps vs. phases 2–7 (file-by-file plan)

- **P2 (typed backend):** migrate Trails off `dashboardDocs` to typed tables
  (`trailLinks` + `trailVisitors`/`trailSessions`/`trailEvents`/`trailBatches`/
  `trailDayAgg`+dimensional aggs/`trailOutbox` (exists)/tombstones) with
  validators + indexes (code unique, visitor, chronology, link/date, batchId,
  pending jobs); narrow queries/mutations; Convex document IDs for relations
  (share codes = lookup values); owner-verified private ops; validated Convex
  identity bridge for browser subscriptions (plain `ConvexProvider`
  insufficient); keep `CONVEX_SERVER_KEY` server-side. Note: `D-TRAILS.md`
  already flags the link-code scan → indexed `trailLinks` as the planned
  follow-up.
- **P3 (tracking):** already Convex; remaining deltas are server-confirmed
  conversions (booking/contact APIs confirming `contact_sent` with deduped
  submission identities) and continued hardening (reload/inactivity/tabs/link
  change/StrictMode/visibility/bfcache) with the existing field semantics.
- **P4 (Stories/Overview):** replace polling shim reads with authenticated
  Convex subscriptions; keep filters/scopes, UTC-day zero-fill, distinct
  browsers, comparison periods, honesty labels, loading/empty/failed/stale
  states (failed ≠ zero).
- **P5 (Links/personalize/notify):** keep workflow; resolve personalization
  from Convex with race-free handoff; explicit Auto-CV false override; revoked
  attribution clears stale state; editor retains input on failed save, no
  duplicate submits; notifications via Convex scheduled actions + Resend with
  transactional queue, bounded retries, idempotency, visible status.
- **P6 (migrate + remove legacy):** dry-run idempotent migration
  `dashboardDocs` Analytics → typed tables (preserve IDs/relations/timestamps/
  counters/labels/pending jobs; coordinated cutover, no duplicate ingestion;
  bounded/resumable; delayed packets never recreate tombstoned visits);
  distinguish revoke-retain-history / delete-with-reconciliation / forget-link /
  prune-keeping-totals; remove Trails Firebase-style deps (already no runtime
  dep) + stale comment references listed below; never import reference-owner
  analytics or fabricate history.
- **P7 (verify/deliver):** owner+visitor contexts end-to-end (create → copy →
  open → personalize → browse → CV/contact → submit → inspect → notify →
  filter → revoke/delete → counters); typecheck/lint/unit/Convex-integration/
  build/Playwright; report real results.

### Stale Firebase-word references to clean (Phase 6, comments/strings only)

`lib/dash-storage.ts` (`BUCKET = "firebase"` comment),
`lib/dash-functions.ts` (Cloud Functions comment), `components/dashboard/*`
(`M-TreasuryEntry`, `D-Projects`, `M-StackItem`, `D-Canary`, `Assistant`,
`D-Tags`, `D-Settings`, `M-ContributorForm`, `M-FirebaseStorage`, `D-MCP`,
`D-Treasury`, `D-Developer`) — comments, variable names (`firebaseBrowserOpen`,
`firestoreRepos`), log strings (`lib/firebase.ts`), URL checks
(`firebasestorage.googleapis.com`). No runtime dependency.

## Phase verification log

- **Phase 1 (2026-10-11):** inspected files above on clean tree after
  `git fetch origin --prune`. `D-trails/` confirmed empty; no Firebase runtime
  in Trails; mapping table complete. Verification: `npm.cmd run typecheck`
  PASS; `npm.cmd run test -- --run tests/trails-ingest.test.ts
  tests/trails-links.test.ts tests/trails-source.test.ts` — 19/19 PASS.
  Status: PASS (mapping committed as
  `docs(trails): map extracted feature to portfolio and Convex`).
