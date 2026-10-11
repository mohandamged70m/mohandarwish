# TRAILS Debug — visitor activity not appearing in dashboard

- Repo: https://github.com/mohandamged70m/mohandarwish
- Production: https://mohanddarwish.vercel.app
- Branch under test (local): `feat/d-trails-editing` @ `6efc4b2`
- Remote: origin/main @ `a25493d` (merge PR #12 of the Trails work — production
  likely serves this if Vercel auto-deploys main; deployed commit unconfirmed).
- Method: fresh automated-browser visitor (no owner session) against production,
  plus local code inspection. No secrets, cookies, or visitor PII recorded here.

## Phase 1 — Establish the failing layer

Tested 2026-10-11 against production with a fresh automated-browser visitor
(no owner session) + direct HTTPS probes. Tested URL:
https://mohanddarwish.vercel.app/ (200, current title).

| Layer | Evidence | Verdict |
|---|---|---|
| Tracker mount | `window.__trails` bridge object exists, `__trails_active=true` | PASS |
| Deployed client bundle | Production chunks contain `batchId`, `linkDropped`, `restartWithCode`, `currentSessionId` → runs current code, not stale assets | PASS (stale-JS hypothesis dead) |
| Eligibility (this probe) | `navigator.webdriver=true`, UA `HeadlessChrome` → `looksAutomated()` refuses `start()`; no `trails_vid`/`trails_sid` written | EXPECTED refusal (bot gate working as designed; constrains testing, not a bug) |
| Eligibility (real browsers) | `webdriver=false` there; no consent gate exists in code; owner/localhost exclusions are the only other gates | Expected PASS — unverified live |
| First flush scheduling | `start()` ends with `push("section")+enqueue(true)` — immediate, not 20s-delayed | PASS by inspection |
| Batch delivery (browser) | No `POST /api/track` in network log — expected consequence of refused start | N/A |
| `POST /api/track` direct probe (clean UA, seq 1, direct hello) | `ok:true, tracked:true, status:applied` (session `dbgprod01-verify01`) | PASS — server + Convex persist |
| Retry same batchId | `status:duplicate` | PASS — ledger persisted, dedupe works |
| Unknown hello code `REVOKED01` | `applied, tracked:true`, NO `linkDropped` key | PARTIAL — server tracks as direct (correct) but the gateway strips `linkDropped`, so the client never clears stale attribution (confirmed defect, fixed Phase 4) |
| `GET /api/share/<bogus>` | 404 (not 503) | PASS — API routes + Convex reads live |
| Console errors on load+scroll | none observed | PASS |
| Rate limiter | `allowRequest(track, 90/min)` keyed on first `x-forwarded-for`, fail-open on Convex errors | PASS by inspection |
| Dashboard reads | Owner-only; no owner session available to this probe | UNVERIFIED |
| Real-browser send | Cannot be faked from a webdriver browser without weakening production filtering (refused) | UNVERIFIED |

Deployed commit: not directly fingerprinted (Vercel exposes none), but the
client bundle contains Phase-3 symbols and the server speaks the current
contract (`v:2`, `batchId` dedupe, direct-visit tracking) → production runs
code at or after PR #12 (origin/main `a25493d`).

Test sessions created (owner: please delete via dashboard when done):
`dbgprod01-verify01` (direct), `dbgprod02-verify02` (revoked-code direct).

Phase 1 conclusion: every recording-side layer that can be probed from outside
passes. The failure is NOT tracker-mount, stale assets, validation mismatch,
rate limiting, or Convex persistence. Remaining suspects: (a) visitors were
tested in owner/localhost context (excluded by design), (b) the owner's
dashboard READ path fails (auth/gateway — unverified), (c) timing (visits
predate the deploy or none occurred since). See Phase 5 questions.

## Phase 2 — Reproduce with a valid visitor

Server-side reproduction (sanctioned minimal footprint, same two sessions):
`applied` → `duplicate` on batch retry → `applied` for revoked-code hello.
Browser-context reproduction is BLOCKED: this probe browser is
`navigator.webdriver=true` and the tracker correctly refuses to start; faking
a non-automated signal would mean weakening production bot filtering, which
is refused. No production filtering was changed for testing.

## Phase 3 — Deployment and configuration

- Deployed client bundle contains Phase-3 symbols → production runs code at
  or after PR #12 (origin/main `a25493d`). No stale-asset mismatch.
- Server↔Convex `CONVEX_SERVER_KEY` match is PROVEN working: a mismatch fails
  every mutation with 500 `unavailable`, but probes returned `applied` /
  `duplicate`. Key values never printed.
- Required env is effectively present: `/api/track`, `/api/share`,
  `/api/auth/session` all respond with contract-correct shapes.
- Owner authentication + private dashboard reads: UNVERIFIED (needs the
  owner's Google session; cannot be probed externally).
- No `npx convex deploy`, merge, or config change performed (unauthorized).

## Phase 4 — Fix the confirmed cause

Confirmed defect: `app/api/track/route.ts` stripped the mutation's
`linkDropped` flag from the JSON response, so the collector's stale-
attribution clearing (documented contract, `collect.ts`) could never fire —
revoked-code tabs kept a dead link's greeting. One-line forward fix +
`tests/trails-track-route.test.ts` (forwards when true, omits otherwise).
This is a real bug but NOT the "no trails" cause (it never blocked
recording); the recording path is proven healthy, so the main complaint
resolves to the still-unverified segments below.

## Phase 5 — Verify and outstanding questions

- New regression tests 2/2 PASS; re-ran full suite + typecheck + scoped lint
  before commit (results in commit message scope below).
- Completion per the phase contract (persisted session the dashboard can
  display) is PARTIALLY proven: sessions `dbgprod01/02-verify0*` persisted
  server-side (duplicate-proof); dashboard DISPLAY of them is unverified
  without owner access.
- Blockers for full closure (need the owner):
  1. What EXACT text does Trails show — error panel, "No visits recorded
     yet", or "Nothing matches that filter"? (Error = read failure.)
  2. Were the test visits made while logged in as owner, or on localhost?
     (Both are excluded by design — test from a logged-out device.)
  3. Did any third-party visit occur AFTER the PR #12 deploy? (Earlier visits
     could not record; owner tests never record.)
- Deployment still required for the Phase 4 fix (and any re-verification):
  merge this branch → Vercel auto-deploys; no Convex deploy needed for this
  fix (no `convex/` change); no prod data touched by the fix.
