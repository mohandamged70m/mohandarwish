# D-Trails — share-link analytics

Dependable analytics for one question: **who opened my share links, and what
did they actually do on the portfolio?** Public portfolio and private owner
dashboard are preserved. Owner-only Google authentication, Next.js,
TypeScript, Convex and the visual identity are unchanged. No `/portal`, no
client accounts.

## What is (and is not) tracked

**Every visit, in full detail.** Share-link recipients and direct arrivals
alike get a complete story: sections, projects, outbound clicks, socials, CV,
contact funnel, scroll, copies, prints, rage, performance, device, geo and
attribution. A hello code that matches a link attributes the visit to it
(greeting, pinned projects, open notification); a code that matches nothing
is dropped and the visit continues as a direct one.

Only the owner (server-verified Auth.js session), obvious bots, and local dev
stay out: no init, no flush, no beacon for them.

## Definitions

- **Visit (session).** One document at `Analytics/Sessions/Items/{id}`. A tab
  resumes its visit while active within 30 minutes (`SESSION_GAP_MS`, measured
  against **last activity**, not start). A new share-link code, an ended
  visit, 12 h of age, or 300 flushes starts a new one. Ended visits never
  resume.
- **Browser visitor.** The stable per-browser id (`trails_vid`). "Unique
  browsers" counts these — **not verified people**. Private mode, a new
  browser or a cleared store is a new "browser".
- **Returning visit.** `visit > 1` for the same browser id: one more visit,
  never one more browser.
- **Tab-open time (`OpenMs`).** Wall clock the tab existed.
- **Active time (`ActiveMs`).** Tab visible **and** the visitor recently gave
  input. The honest engagement number.
- **Idle time (`IdleMs`).** No input for 60 s. An open tab is not attention.
- **Project opens.** `projectOpen(id)` on viewing a project; outbound clicks
  split into `live` / `github` / `download`. Time on an open project accrues
  only while active and visible; routine flushes bank time **without** closing
  the project.
- **Contact opens.** Modal/section views, cooldown-guarded against observer
  flap. **Confirmed submissions** are `contact_sent` events written
  **server-side**: the form attaches the visit id plus a stable per-submit id
  to its persistence request, and `/api/booking` (`meeting`) or
  `/api/messages` (`message`) confirms via `trails.confirmConversion` only
  after its own write succeeds. Retried deliveries of one submission confirm
  once; a browser claim alone never counts. Rows predating server confirmation
  may still carry browser-reported `contact_sent`.
- **Time away.** `social_back` measures time **away from the portfolio**, never
  time spent on another site.
- **Rage.** Only three fast clicks in the same spot (`rage:rapid`). Clicks on
  non-interactive content are ordinary reading, not frustration.
- **Attribution lifetime.** Link attribution expires after 12 h
  (`trails_link_at`); stale or deleted codes clear the stored link, greeting
  and campaign backup, and the visit stops (`untracked`).

## Honesty rules (shown in the UI)

- A link's **"Who it is for" is an owner label, not verified identity.**
  Stories read "Visit via [link label]"; the dashboard never claims a named
  recipient definitely visited.
- Unknown referrer/geo stays **unknown**. A missing referrer does not prove
  someone typed the URL ("unknown origin", never "direct").
- **Opens and Sessions differ again.** `Totals.Sessions` counts every visit;
  `Totals.LinkOpens` counts link-attributed ones. On a single link card both
  counters still move together per open, so the card shows **visits** once.
  Lifetime totals are labelled as such; stories are the latest 300 retained.
- **Project scores are heuristic** engagement weights
  (view×1, demo×4, repo×3, download×6) — not conversion probabilities.
- Charts use **UTC days**; missing days are zero. Weekly/monthly ghost lines
  compare same-aggregation periods, not single daily values.
- **"Reading now"** means "not ended and heard from within 60 s", recomputed
  on a 15 s clock; future timestamps are never live. It is recent activity,
  not proven reading.

## Storage and field semantics

One transactional Convex mutation (`trails.applyFlush`) writes the session
**and** every aggregate together — day, totals, sources, socials, link,
project views, notification outbox. A failed call leaves `Seq` unapplied, so
the client retries the **same immutable batch** (`seq` + stable `batchId`);
the server dedupes by `batchId` and drops `seq` replays. Concurrent opens
resolve to one counted visit.

- **Add** only counter deltas (visits, ms, opens, clicks, events count).
- **Replace** timestamps (`LastSeenAt`, `EndedAt`), state
  (`Exit.Section`, `Contact.Tab/Sent`, `Perf`), never add them.
- **Maximum** scroll percentages per section.
- **Append** validated timeline events once, capped at 500 per visit and 120
  per flush; keepalive bodies stay under ~55 KB by trimming oldest-first.

Terminal responses (never retried): `bad-identity`, `bad-batch`, `expired`
(410), `unknown-visit` (404), `deleted` (tombstoned), `bot`. A hello code
matching no link returns `linkDropped` with the visit kept as direct; the
client clears the stale attribution and keeps recording. Retryable
failures back off (1 s…30 s, 8 tries) with a bounded persisted outbox (5
batches in sessionStorage). **After a browser forcibly terminates
(`pagehide`/`beforeunload` keepalive), delivery is best-effort, not promised.**

## Links, deletion, retention

- Links are created server-side with collision-safe ids and unique 8-char
  codes (`trails.createLink`); edits are field-validated
  (`trails.updateLink`). The editor stays open with its input on save
  failure.
- **Delete a visit** (`trails.deleteSession`) subtracts its contribution from
  every aggregate in the same transaction and tombstones the id, so delayed
  retries are terminal (`deleted`), never recreated.
- **Forget a link's visits** matches by `Link.DocId` (never the share Code),
  reconciles every aggregate and zeroes the link card.
- **Remove a link** deletes only the link; historic visits and aggregates are
  retained (orphaned stories keep their data honestly).
- **Retention prune** (`trails.pruneSessions`) drops old session rows but
  **keeps lifetime totals**. It is explicit and manual — nothing auto-erases.
- **Migration/repair.** `trails.reconcileDryRun` is read-only: corrupt rows
  (summed timestamps, scroll > 100, negative counters), orphaned stories and
  retained-vs-totals drift. `trails.repairSessionFields` (dry-run by default)
  clamps impossible field values idempotently. Aggregate history is never
  rewritten — pruned history cannot be reconstructed, and exact historical
  counts are never fabricated.

## Ownership, privacy, abuse

- Ownership resolves **server-side** from the HttpOnly Auth.js session on
  every flush (`/api/track`) and every dashboard/gateway call. Browser hints
  only avoid starting the tracker; `body.owner` is ignored. Owner visits are
  recorded but never counted; mid-visit recognition subtracts earlier counts.
- No PII is stored: paths carry no query strings, referrers are stripped to
  origin+path, copies count events without contents, form text and clipboard
  data are never recorded.
- **Consent banner required.** Tracking every visitor with a persistent
  browser id (`trails_vid` in localStorage) needs visitor consent in the EU
  and similar regimes. Do not run all-traffic Trails in production without a
  consent gate that keeps the tracker off until accepted.
- Server-side abuse protection: per-IP rate limit (90 flushes/min), strict
  identity validation, payload/event caps, bot user-agent rejection. Client
  heuristics alone are not authoritative.
- Notifications: link-open email is queued in `trailOutbox` inside the same
  transaction as the visit. `/api/track` sends inline and marks `sent`;
  failures stay `pending` for the owner drain
  (`POST /api/dashboard/trails-outbox`; `GET` reports the backlog).
  Unconfigured mail (`OWNER_EMAIL`/`RESEND_API_KEY` unset) skips silently and
  accurately.

## Environment

`NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SERVER_KEY` (same value in Next.js and the
Convex deployment), `DASHBOARD_OWNER_EMAIL`, `AUTH_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OWNER_EMAIL`, `RESEND_API_KEY`,
`RESEND_FROM`. No secret values are logged; no visitor details leave the
server except the owner notification email.

## Remaining limits

- Link-code resolution still scans the bounded link collection inside the
  transaction (an indexed `trailLinks` table is the planned follow-up).
- `contact_sent` rows written before server confirmation may be
  browser-reported; current writes are confirmed by the booking/contact APIs
  with deduped submission identities.
- Funnel/date-range/source/device scoping beyond the link filter is not built;
  metric cards are lifetime scope by design.
- Old cached client JS without `batchId` receives terminal `bad-batch` and
  stops; redeploying serves current JS.
