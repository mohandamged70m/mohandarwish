# Trails reliability repair — 2026-10-11

## Current production path

The active path is `TrailsTracker` → browser collector → `/api/track` →
`trails.applyFlush` → Convex `dashboardDocs` at `Analytics/*`. The dashboard
reads those same documents through `/api/data`. Typed `trailStore` tables and
migration helpers exist, but are not the active gateways. Do not switch only
one side: that would split writes from reads and make recorded visits appear
missing. This repair preserves the active store and all historical data.

No new secrets, schema changes, or data migration are required. The existing
`NEXT_PUBLIC_CONVEX_URL` and matching `CONVEX_SERVER_KEY` remain necessary.
Client social names are normalized before posting, so the normalization fix
also works with the currently deployed backend.

## Fixed failures

- Invalid/deleted-link `linkDropped` now survives the gateway and clears stale
  greetings, campaign attribution, and link state while recording continues.
- Link A → B and direct → link transitions end through the same serialized
  queue; pending counters are kept. A late old response cannot set the new
  visit's hello/ended state or greeting.
- Batches deeply snapshot mutable scroll/performance fields. Retries preserve
  the original payload; persisted queues preserve the opening first. Memory is
  bounded to 50 batches and persistence to 5; network requests have a deadline.
- `flushNow()` waits for the current delivery instead of returning while its
  first request is still in flight.
- Idle ticks no longer extend last activity. Visits roll over on renewed input
  after a 30-minute gap, after 12 hours, or before the flush ceiling. Invalid
  persisted browser ids are regenerated.
- Terminal owner/bot responses stop recording even with HTTP 200. Owner
  recognition still reconciles previously counted activity server-side.
- Initial project-page arrivals record an open. Repeated opens are deduped;
  navigation away banks and closes project time.
- Section observers handle streaming/late route mounts, normalize section
  names, and select the most visible section. Modal clicks are captured even
  when a modal stops event bubbling.
- Social network hostnames/URLs normalize to one network. Explicit labels no
  longer resolve as relative URLs to the portfolio's own domain.
- Cancelled `beforeunload` and bfcache freezes no longer end a live visit.
- Auto-CV opens from the persistent modal host after `/` commits, rather than
  from a timer cancelled when the share landing unmounts.
- Notification status requires an actual provider delivery id. Unconfigured,
  failed, and test-mode-skipped sends remain pending/retryable. Inline and
  outbox sends use one visit idempotency key and the identical persisted
  opening metadata, so a lost mark-sent acknowledgement cannot duplicate mail.
- The notification backlog counts up to 50 due rows and labels its bound.
- The owner-only, read-only `/api/dashboard/trails-health` panel distinguishes
  missing configuration, unavailable functions, failed reads, and a connected
  empty store without publishing secrets or generating test visits.

## Verification

- `npm test`: 98 tests across 16 suites, including client lifecycle tests,
  React tracker/Auto-CV tests, gateway/mail regression tests, existing Convex
  tests, and a collector → Next gateway → Convex → owner dashboard pipeline.
  The pipeline records direct and link visits, checks access control, and
  verifies transactional deletion/totals reconciliation.
- `npm run typecheck` and scoped Trails ESLint are required.
- `npm run build` verifies the production route bundle.
- `.github/workflows/trails-checks.yml` repeats those checks on pushes to main
  and pull requests. jsdom is a development-only dependency for client tests.
- Live pre-change smoke check: a deliberately invalid identity reached Convex
  and returned terminal `bad-identity` without storing a synthetic visit.
- Playwright browser execution is not verified here: Chromium's download
  returned an invalid archive. The automated browser is intentionally bot-
  excluded; existing browser tests also need deployed Convex configuration.

## Check a real visit after deployment

1. Sign in as owner and open Dashboard → Trails. Check the storage panel.
2. In another browser or signed-out incognito tab, open `/`, view a project,
   click its repository/demo, open CV/contact, and wait about 20 seconds.
3. Refresh/poll Stories. Open the visit and check its timeline, project, and
   section counters; the active dashboard refresh interval is 15 seconds.
4. Create a link, set greeting/pins/Auto-CV, and open it in the visitor browser.
   Check link attribution, one open, Auto-CV, and notification status if mail
   is configured. Change links in that tab and check distinct stories.
5. Owner visits, private dashboard routes, local development hosts, and
   obvious bots are excluded. The health panel checks reads; it does not
   claim a real visitor's browser successfully sent a flush.

Closing a browser forcibly is still best-effort. Five pending batches survive
reload; a prolonged outage can lose deltas beyond that bound. Existing
historical social-name variants are preserved rather than rewriting history.
