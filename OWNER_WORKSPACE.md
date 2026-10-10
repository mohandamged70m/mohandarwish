# Personal portfolio and owner workspace

The public website remains a personal portfolio. `/dashboard` contains a private
Workspace tab for client work. There is no `/portal`, client sign-in or invitation
flow. Visitors continue to use contact and booking.

## Configure before deployment

| Variable                 | Next.js / Vercel                                  | Convex                     |
| ------------------------ | ------------------------------------------------- | -------------------------- |
| `NEXT_PUBLIC_CONVEX_URL` | Deployment URL                                    | —                          |
| `DASHBOARD_OWNER_EMAIL`  | The only Gmail allowed into `/dashboard`          | —                          |
| `AUTH_SECRET`            | Random Auth.js session secret (≥32 chars)         | —                          |
| `AUTH_GOOGLE_ID`         | Google OAuth client ID                            | —                          |
| `AUTH_GOOGLE_SECRET`     | Google OAuth client secret                        | —                          |
| `RATE_LIMIT_SECRET`      | Optional rate-limit key (falls back to `AUTH_SECRET`) | —                      |
| `CONVEX_SERVER_KEY`      | Independent random secret                         | Identical server-key value |

Generate `AUTH_SECRET` (and the optional `RATE_LIMIT_SECRET`) with `npx auth secret`
or a password manager. Create the Google OAuth client in Google Cloud Console →
APIs & Services → Credentials → OAuth client ID (Web application), registering
these exact redirect URIs:

- `http://localhost:3000/api/auth/callback/google`
- `https://<your-production-domain>/api/auth/callback/google`

Configure the Convex server key in its deployment settings or
`npx convex env set CONVEX_SERVER_KEY`. Do not commit credentials. Preserve
existing email, calendar and other server environment variables. `.env.example`
contains placeholders only.

All exported Convex functions still require the server key. Only Next.js passes
it. Owner access uses “Sign in with Google” (Auth.js): only the verified Gmail
address in `DASHBOARD_OWNER_EMAIL` (compared case-insensitively, Google's
verified-email claim required) may use `/dashboard` and the private APIs — every
other Google account lands on an access-denied state, and every private page,
API route, upload and dashboard operation re-checks ownership server-side.
There is no `/portal`, client login or invitation flow. Sign out ends the Auth.js
session; rotating `AUTH_SECRET` expires all sessions.

## Deployment order

1. Use a separate Convex development/preview deployment and configure its server
   key. Run `npx convex dev` to validate schema and regenerate API declarations.
2. Configure a Vercel preview with its matching URL and server key, plus the owner
   email, Auth.js secret and Google OAuth client. Deploy the updated Convex functions and test the preview.
3. Run lint, typecheck, unit tests, production build and browser checks. In the
   preview, also verify an actual contact submission, owner sign-in, project
   save, upload and booked call using configured integrations.
4. Schedule the production transition: update Convex and deploy the app together.
   The old app cannot call the new authenticated functions, so an uncoordinated
   deployment causes failed reads/writes. Keep writes paused during the switch.
5. Confirm the private workspace returns 401 without an owner session, a
   non-owner Google account sees access-denied, and public contact/booking save
   records before reporting success.

The schema adds new tables and optional booking fields; existing public projects,
messages and confirmed legacy bookings remain valid. The PR does not configure
production secrets or deploy Convex. Avoid an app-only rollback. Prefer a forward
fix; reverting to the old backend also restores its unauthenticated data access.

## Workspace behavior

- New contact messages create inquiry leads in the same database transaction.
  Historical inbox entries are not imported automatically; add those leads manually.
- Leads progress through inquiry, qualified, proposal, won and lost. Starting a
  project marks its source lead won when the project is saved.
- Private projects track client details, brief, status, due date, invoice link and
  payment status. This is manual tracking, not payment processing.
- Milestones track delivery, preview links and owner-recorded review status.
  Feedback received through email or other channels can be recorded in notes.
- Private project records live in `workProjects`, separate from public portfolio
  documents. Nothing is published automatically. The UI shows the most recent
  100 leads/projects, 100 notes per project and up to 50 milestones per project.

Public project editing now includes problem, role, highlights and metrics. Add
real outcomes through the Projects tab; no results have been invented for you.
The hero explains the service and offers a visible work CTA. Projects come before
the technology section on the homepage.

## Reliability and limitations

Browser database and storage requests use allowlisted Next.js gateways. Public
reads project only approved portfolio fields; private settings require the owner
session. Snapshot listeners refresh every 15 seconds, workspace lists every 20
seconds, and notes when a project is selected or saved. They are not push updates.

Public attachments accept limited file types, up to 10 MB, through a rate-limited
server endpoint. Persistence failures return an error instead of claiming success.
Booking checks offered availability and reserves an overlapping one-hour slot
atomically. Pending reservations expire after two minutes. Expired pending rows
are excluded from the calendar and inbox but retained for investigation.

Calendar operations and email delivery are external to the database transaction.
A calendar timeout can leave an external event behind, and a database failure
after calendar creation can leave a pending reservation. Review the calendar and
database before retrying those cases; this change does not add external-event
idempotency or reconciliation. Email failures do not undo saved contacts/bookings.
Availability and booked-slot APIs retain their public fallback display, while
booking writes fail closed when the backend is unavailable.

## Local checks

```bash
npm ci
npx next typegen
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests exercise Convex transactions in memory. Browser workspace tests use
API fixtures; public access-denial checks hit the built Next.js server. Neither
replaces a preview test against your real configured Convex/email/calendar setup.
