# TRAILS Implementation — Convex-native (phased)

Reference: `D-trails/` (git-ignored local extraction from
https://github.com/TemRevil/revil @ `19b85f3f`, 2026-10-05; manifest in
`D-trails/README.md`). Compared file-by-file against the portfolio below. No
reference-owner content, credentials, domain, or mail config is copied.
License attribution for reused code is kept in `NOTICE` (MIT, Tem Revil).

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

### Firebase → Convex mapping (reference → portfolio destination)

The reference backend is Firebase: `trackSession` HTTPS Cloud Function
(`D-trails/functions/analytics.ts`, manual App Check, `WriteBatch` commit —
not a transaction), Firestore collections with admin-only rules and zero
client writes (`D-trails/firestore.rules`), direct client link CRUD, and
nodemailer-via-Resend-SMTP notifications (no outbox, no tombstones). Every
reference operation has a Convex destination in this repo:

| Reference (Firebase) | Portfolio (Convex) destination |
|---|---|
| `trackSession` CF + `WriteBatch` | `POST /api/track` → `trails.applyFlush` single transaction (session + day/totals/sources/socials/link/project deltas + batch dedupe + outbox row commit/rollback together) |
| `Analytics/Sessions/Items/*`, `Days/*`, `Sources/*`, `Socials/*`, `Totals`, `Projects/{id}.Views` | Same shapes in generic `dashboardDocs` (`Analytics/*` path emulation); typed `trailOutbox` table. Typed `trail*` tables are Phase 2. |
| `Links` query `where("Code","==",code)` | Same bounded scan inside `applyFlush` (indexed `trailLinks` table is the planned follow-up per `docs/D-TRAILS.md`) |
| Client `onSnapshot` listeners | `lib/dash-db.ts` polling snapshots over `POST /api/data` (authenticated Convex subscriptions are Phase 4) |
| Client link CRUD (random code + numeric `max+1` id) | Server `trails.createLink` (collision-safe id/code), `updateLink`, `deleteLink` |
| Client story delete + `increment(-1)` | `trails.deleteSession` / `forgetLinkVisits` with aggregate reconciliation + tombstones (delayed retries → terminal `deleted`) |
| Manual App Check + `revil_owner` localStorage | Auth.js owner session verified server-side per flush/gateway call; per-IP rate limit, strict identity/batch validation, bot UA reject, payload caps |
| `sendOpenedEmail` (SMTP, fire-and-forget) | Resend inline send + `trailOutbox` row; failure stays `pending` for owner drain `POST /api/dashboard/trails-outbox` |
| `geoip.ts` (IP never stored) | Edge headers (`x-vercel-ip-country`/`cf-ipcountry`) only; unknown stays unknown |
| `{origin}/revil/{Code}`, `?s=` story link | `/mohanddarwish/[code]` landing + `/dashboard?s=` story park |
| `/book` + `useBookTrail` (`contact_sent: book`) | No `/book` route; `contact_sent: book` kept only for legacy rows |

Deliberately excluded: reference MCP amplification (`functions/src/mcp.ts`
Trails reads), `notifyCanary`/login/receipt LLM callables, meeting-sync
proxy, `LegacyRec` link field, `sawBookPage`/`book` story filter (replaced by
`direct`), dead-click `rage:dead`, email/phone copy classification (PII).

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
- **Phase 1 (2026-10-11):** inspected portfolio files on clean tree after
  `git fetch origin --prune`; staged reference extraction from
  TemRevil/revil @ `19b85f3f` into git-ignored `D-trails/` (manifest in
  `D-trails/README.md`); completed Firebase→Convex mapping above; added MIT
  attribution in `NOTICE`. Verification: `npm.cmd run typecheck` PASS;
  `npm.cmd run test -- --run tests/trails-ingest.test.ts
  tests/trails-links.test.ts tests/trails-source.test.ts` — 19/19 PASS.
  Status: PASS.
- **Phase 2 (2026-10-11):** new typed store in `convex/schema.ts` +
  `convex/trailStore.ts`, additive alongside the live `dashboardDocs` backend
  (no traffic moved; cutover is Phase 6).
  - Tables/validators/indexes: `trailLinks` (by_code, by_created), `trailVisitors`
    (by_visitor), `trailSessions` (by_sid, by_started, by_visitor_started,
    by_link_started), `trailEvents` (by_session_t), `trailBatches` (by_batch,
    by_session), `trailDays` (by_day), `trailTotals` (by_key), `trailSources` /
    `trailSocials` / `trailProjects` (by_name/by_project), `trailTombs` (by_sid);
    `trailOutbox` reused. Relations use Convex document IDs (`linkId`);
    share codes are lookup values only.
  - Functions: `applyBatch` (transactional ingest, same add/set/max/append
    semantics + batchId dedupe + tombstones + owner exclusion/reversal +
    outbox queue), `createLink`/`resolveLink`/`listLinks`/`updateLink`/
    `deleteLink` (retain history), `listSessions` (composite (startedAt,_id)
    cursor pagination, link/date/activity/search filters), `getStory`,
    `overview`, `distinctVisitors`, `deleteSession`, `forgetLinkVisits`,
    `pruneSessions` (keeps totals), `outboxList`/`outboxSet`, `diagnostics`.
    Every private op verifies `CONVEX_SERVER_KEY`; the key never leaves the
    server (gateway pattern kept — no browser `ConvexProvider`; subscription
    identity bridge is a Phase 4 decision).
  - Verification: `tests/trail-store.test.ts` 9/9 PASS (auth, code uniqueness,
    indexed resolve, transactional counters, duplicate/replay, owner reversal,
    delete+forget reconciliation, tombstoned-retry terminal, pagination,
    distinct browsers); full suite 46/46 PASS; `typecheck` PASS; scoped
    `eslint` on touched files clean (0 errors). `convex/_generated/api.d.ts`
    hand-extended for `trailStore` until the next `npx convex dev` codegen.
  Status: PASS.
- **Phase 3 (2026-10-11):** server-confirmed conversions; tracking producers
  were already connected (sections, project open/close/outbound incl.
  demo/repo/download, CV, social outbound+return, contact open, message/booking
  persistence) with immutable-batch dedupe and explicit field semantics, so no
  producer changes were needed.
  - `trails.confirmConversion` + `trailStore.markConversion`: called by
    `/api/booking` (`meeting`) and `/api/messages` (`message`) only after
    their own persistence succeeds; dedupe by stable per-submit id (capped
    ledger), terminal-safe on unknown/deleted visits, never throws into the
    booking/message response. No aggregates move (Sent is state).
  - Client is no longer a writer: `BookingModal` attaches `{sid, sub}` via the
    new `window.__trails.sid()` bridge (`analytics.currentSessionId()`); the
    `contact-sent` client claims were removed. `collect.contactSubmit` and the
    tracker `contact-sent` bridge remain as a compatibility path.
  - Verification: `tests/trails-convert.test.ts` 3/3 PASS (once-per-submission,
    unknown-visit safety, typed-store parity);
    `tests/trails-convert-routes.test.ts` 4/4 PASS (confirm on persist for both
    routes, submission surviving confirm failure, untouched saves without
    attribution); full suite 53/53 PASS; `typecheck` PASS; scoped `eslint`
    clean (0 errors, 0 warnings).
  Status: PASS.
- **Phase 4 (2026-10-11):** Stories + Overview integrated against an
  acceptance audit (18 gaps found; all FAILs fixed except advisory polling
  load, left documented).
  - Stories: display pagination (50/page + "Show more", honest "showing X of
    Y" caption), date presets (24h/7d/30d/all) scoping stories + chart +
    browsers, conversion filter (`Converted` on `Contact.Sent`; `Reached
    contact` now means funnel entry), search kept. `?s=` survives owner login
    (`page.tsx` threads it into the sign-in `callbackUrl`; `auth-buttons.tsx`
    accepts it; `DashboardClient` park unchanged).
  - Overview: failed reads render error panels + Retry (never zeros), first-
    load skeletons for counters/chart/links, `updatedAt` kept; lifetime cards
    stay lifetime-labelled with an in-range browser line computed from loaded
    visits; link filter shows a scoped banner with lifetime link counters.
  - Chart: weekly/monthly zero-filled across the UTC continuum, all labels +
    tooltips + page titles UTC, YoY same-aggregation comparison now rendered
    as a dashed ghost line + tooltip row (was dead code).
  - Honesty: `% acted` chip (was `% conv`), away time `~X (estimated)`,
    `Browser (reported)`, rapid-click rage label, chronological event sort.
  - A11y: focus trap + focus return for the story modal, dialog semantics +
    Escape/initial focus for confirm modal, dialog role for the link editor,
    `aria-live` on live-count + alerts, `aria-pressed` on filter groups,
    `useReducedMotion` gating chart/modal/pulse transitions.
  - Verification: full suite 53/53 PASS; `typecheck` PASS; scoped `eslint`
    clean (fixed 4 react-hooks purity errors via clock state + paging
    wrappers); production `next build` PASS (29 routes).
  Status: PASS.
- **Phase 5 (2026-10-11):** links, personalization, and notifications —
  audited end to end (create → copy → open → personalize → track → inspect →
  notify → revoke); the workflow already existed, fixed the gaps found.
  - Personalization: explicit Auto-CV false already overrode defaults
    (`wantsAutoCv`); revoked/expired codes now clear stale attribution
    (`clearStaleAttribution` in `landing.tsx`: link, timestamp, tailor, and
    campaign backup dropped so the visit continues direct). Fixed-delay
    handoffs were already race-free (synchronous stash + sessionStorage backup
    + retried live handoff; delays only time the CV modal).
  - Submit guards: create disabled while creating; editor Save disabled while
    saving; editor still keeps input open on failed saves.
  - Notifications: `outboxDue` (pending + failed with attempts < 3, bounded)
    and `outboxRecent` (per-link status) on both `trails` and `trailStore`;
    drain sends oldest-first with stable Resend idempotency keys per visit and
    per outbox row (`sendSafe` gained an options arg); inline `/api/track`
    send keyed per visit; email failure still never loses the visit. `GET`
    now returns backlog + recent rows; Links view shows stored status per card
    (sent / pending / failed ×N with retry note) plus a drain button.
  - Verification: `tests/trails-notify.test.ts` 3/3 PASS (bounded retries on
    both backends, idempotency-key forwarding); `tests/trails-notify-routes.
    test.ts` 3/3 PASS (backlog+status report, keyed sends marked sent,
    failure marking without losing the queue); full suite 59/59 PASS;
    `typecheck` PASS; scoped `eslint` clean.
  Status: PASS.
- **Phase 6 (2026-10-11):** migration + legacy removal.
  - `convex/trailMigration.ts`: `status` (legacy vs migrated counts) and
    `migrate({limit, write})` — dry-run by default, bounded (default 200
    sessions/call), resumable, idempotent (re-runs skip by `by_sid`/code/tomb;
    repeat execution creates no duplicates). Order: tombstones first (delayed
    packets can never recreate deleted visits through the typed ingest), then
    links (matched by code, never overwritten), sessions + events + batch
    ledger + visitor upsert, then aggregates copied as-is (days, lifetime
    totals, sources, socials, project counters; project ms summed from the
    migrated sessions since the old model has no per-project rollup). The
    outbox is already the shared typed `trailOutbox` table — pending jobs
    stay pending, nothing to copy. Legacy `Confirmed` maps inherit the
    session's `Contact.Sent` kind (documented); pruned history is not
    reconstructed or fabricated.
  - Revoke (retains history) vs delete (reconciles + tombstones) vs
    forget-link (reconciles + zeroes card) vs prune (keeps totals) are
    implemented identically on both backends; migration preserves tombstones
    and counters so the distinctions survive the move.
  - Legacy removal: verified zero Firebase imports repo-wide and no
    `firebase` dependency in `package.json` — Trails has no Firebase runtime
    dependency to remove (only stale words in unrelated dashboard comments,
    left untouched as non-Trails churn).
  - Cutover runbook (manual; never automatic, never touches prod data by
    itself): 1) `npx convex deploy` the additive backend (regenerates
    `_generated`; no traffic impact). 2) `trailMigration.status`, then
    `migrate({write:false})` dry-run. 3) `migrate({write:true})` in batches
    until `done` (low-traffic window). 4) Verify: compare `trails.
    diagnostics` vs `trailStore.diagnostics` (sessions/links/totals) and
    spot-check stories. 5) Switch ingestion + reads atomically in one deploy
    (`/api/track` → `trailStore.applyBatch`, `/api/share` → `trailStore.
    resolveLink`, dashboard gateway ops → `trailStore` reads/writes,
    `confirmTrailsConversion` → `markConversion`). Duplicate ingestion is
    prevented because batch ledgers migrate too — in-flight client retries
    dedupe by `batchId` on the new backend. 6) Rollback = flip the same
    targets back (migration only reads the old model; typed writes land in
    new tables). Cutover NOT executed here.
  - Verification: `tests/trail-migration.test.ts` 4/4 PASS (status counts,
    dry-run writes nothing, faithful copy + relink + exact totals + tombstone
    enforcement + idempotent repeat, bounded resume); full suite 63/63 PASS;
    `typecheck` PASS; scoped `eslint` clean.
  Status: PASS.
- **Phase 7 (2026-10-11):** verify and deliver (continued below).
  - 1. Phase checklist: P1 map ✓ (`97c8f54`, `5d4514d`), P2 typed backend ✓
    (`0bd7a60`), P3 tracking+conversions ✓ (`5e4100b`), P4 stories/overview ✓
    (`de33878`), P5 links/notify ✓ (`122384d`), P6 migration ✓ (`7a1caee`),
    P7 this commit. All on branch `feat/d-trails-editing`.
  - 2. Feature summary: Stories (paginated cards, search, date/link/
    activity/contact/conversion filters, chronological modal, deep links that
    survive login, clock-expired presence), Overview (lifetime cards with
    honest labels, UTC zero-filled daily/weekly/monthly charts with a rendered
    same-period-last-year ghost, project rankings, source/social breakdowns,
    in-range browser counts, failed-read error panels + skeletons), Links
    (server-allocated codes, `/mohanddarwish/[code]`, greeting/Auto-CV
    (explicit false wins)/pinned, edit/revoke/forget, per-card stored email
    status + retry). Tracking: immutable batches, transactional ingest,
    server-confirmed conversions; notifications: transactional outbox, inline
    send + owner drain with bounded retries and provider idempotency.
  - 3. Convex: tables `trailLinks` (by_code, by_created), `trailVisitors`
    (by_visitor), `trailSessions` (by_sid, by_started, by_visitor_started,
    by_link_started), `trailEvents` (by_session_t), `trailBatches` (by_batch,
    by_session), `trailDays` (by_day), `trailTotals` (by_key), `trailSources`/
    `trailSocials`/`trailProjects` (by_name/by_project), `trailTombs`
    (by_sid), shared `trailOutbox` (by_status, by_session). Functions:
    live `trails.*` (applyFlush, confirmConversion, link/session/outbox ops);
    typed `trailStore.*` (applyBatch, markConversion, resolveLink/listLinks,
    listSessions/getStory/overview/distinctVisitors, delete/forget/prune,
    outboxList/outboxSet/outboxDue/outboxRecent, diagnostics);
    `trailMigration.*` (status, migrate dry-run/bounded). Auth: every private
    op verifies server-side (`CONVEX_SERVER_KEY` via Next.js gateway or
    Auth.js owner session); the key never reaches the browser; no browser
    `ConvexProvider` (gateway polling retained deliberately — subscription
    identity bridge deferred, documented in P2).
  - 4. Test results: `typecheck` PASS; vitest 63/63 PASS across 11 files
    (ingest semantics, dedupe/replay, owner reversal, link uniqueness,
    conversions once-per-submission, conversion routes, bounded notification
    retries + idempotency, drain routes, migration idempotency/resume,
    security gateway); scoped `eslint` clean on all touched files (full
    repo-wide `eslint` exceeds local time budget — noted); `next build` PASS
    (29 routes). Playwright `tests/browser/trails.spec.ts` NOT run: it boots
    `npm start` against the configured Convex deployment and writes a real
    session, which would modify production data — blocked by the no-prod-data
    rule. Unblock: point env at a dev deployment, `npx convex deploy`, run
    `npx playwright test`, then delete the `pwtest01-*` session.
  - 5. Environment variable names (no values): `NEXT_PUBLIC_CONVEX_URL`,
    `CONVEX_SERVER_KEY`, `DASHBOARD_OWNER_EMAIL`, `AUTH_SECRET`,
    `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OWNER_EMAIL`, `RESEND_API_KEY`,
    `RESEND_FROM`. No new variables introduced.
  - 6. Migration/cutover: see Phase 6 runbook above (status → dry-run →
    batched `migrate({write:true})` → diagnostics compare → atomic gateway
    switch → rollback by flipping back). Not executed; no prod data touched.
  - 7. Remaining limitations: live traffic still runs on the `dashboardDocs`
    backend (typed store + migration landed additive, awaiting the manual
    cutover + `npx convex deploy`); browser reads poll via gateway (no live
    Convex subscriptions); in-range browser counts derive from loaded visits
    (labelled); legacy pre-confirmation `contact_sent` rows stay claimed;
    failed outbox rows exhaust after 3 attempts and stay visible; two-browser
    owner/visitor e2e still needs a dev deployment + owner login.
  - 8. Branch and commits: `feat/d-trails-editing` — `97c8f54`, `5d4514d`,
    `0bd7a60`, `5e4100b`, `de33878`, `122384d`, `7a1caee`, plus this commit.
  Status: PASS with the Playwright/cutover blockers documented above — not
  claimed on build alone (63 integration tests + typecheck + production build
  all green).
