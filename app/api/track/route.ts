import { NextResponse } from "next/server";
import { convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { auth } from "@/auth";
import { isOwnerSession } from "@/lib/owner";
import { allowRequest } from "@/lib/rate-limit";
import { trailNotification } from "@/lib/trails-notification";
import { getResendFrom, sendSafe } from "@/lib/resend";

// Trails ingest gateway. The browser buffers a visit and POSTs immutable
// numbered batches here (lib/analytics/collect.ts); the single Convex
// mutation api.trails.applyFlush applies session + aggregates atomically.
// Ownership comes from the Auth.js session (HttpOnly) — never body.owner.
// Public direct visits and valid share-link visits are both recorded.

export const dynamic = "force-dynamic";

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|preview|monitor|scrape|curl|wget|python-requests|axios|node-fetch|datadog|uptimerobot/i;

type Dict = Record<string, unknown>;
const isObj = (v: unknown): v is Dict =>
  !!v && typeof v === "object" && !Array.isArray(v);

function edgeGeo(req: Request): { Country: string; Code: string } {
  // Only trust headers from known edge providers; anything else stays unknown.
  const vercel = req.headers.get("x-vercel-ip-country")?.toUpperCase() || "";
  const cf = req.headers.get("cf-ipcountry")?.toUpperCase() || "";
  const raw = /^[A-Z]{2}$/.test(vercel) ? vercel : /^[A-Z]{2}$/.test(cf) ? cf : "";
  if (!raw) return { Country: "", Code: "" };
  try {
    return {
      Country: new Intl.DisplayNames(["en"], { type: "region" }).of(raw) || "",
      Code: raw,
    };
  } catch {
    return { Country: "", Code: raw };
  }
}

export async function POST(req: Request) {
  let body: Dict;
  try {
    const parsed: unknown = await req.json();
    if (!isObj(parsed))
      return NextResponse.json({ ok: false, terminal: true, reason: "bad-body" }, { status: 400 });
    body = parsed;
  } catch {
    return NextResponse.json({ ok: false, terminal: true, reason: "bad-body" }, { status: 400 });
  }

  // Bounded abuse protection before the transactional write.
  try {
    if (!(await allowRequest(req, "track", 90, 60_000)))
      return NextResponse.json({ ok: false, terminal: false, reason: "rate-limited" }, { status: 429 });
  } catch {
    // Rate-limit store unavailable: fail open for tracking, tracking never breaks the page.
  }

  const ua = req.headers.get("user-agent") || "";
  if (ua && BOT_RE.test(ua))
    return NextResponse.json(
      { ok: true, tracked: false, hello: true, terminal: true, reason: "bot" },
      { status: 200 },
    );

  let owner = false;
  try {
    owner = isOwnerSession(await auth());
  } catch {
    owner = false;
  }

  try {
    const result = (await convexMutation(api.trails.applyFlush, {
      id: body.id,
      seq: body.seq,
      batchId: body.batchId,
      visitor: body.visitor,
      visit: body.visit,
      add: isObj(body.add) ? body.add : {},
      set: isObj(body.set) ? body.set : {},
      events: Array.isArray(body.events) ? body.events : [],
      hello: isObj(body.hello) ? body.hello : null,
      end: body.end === true,
      owner,
      geo: edgeGeo(req),
      startedAtHint: typeof body.startedAtHint === "number" ? body.startedAtHint : undefined,
    })) as Dict | null;

    if (!result || typeof result !== "object")
      return NextResponse.json({ ok: false, terminal: false, reason: "unavailable" }, { status: 500 });

    // The mutation still reconciles a visit first recognised as the owner,
    // then the browser stops recording it (including successful HTTP 200s).
    if (owner)
      return NextResponse.json({ ok: true, tracked: false, hello: true, terminal: true, reason: "owner" });

    const status = String((result as Dict).status || "");
    if (status === "terminal") {
      const reason = String((result as Dict).reason || "rejected");
      const code = reason === "expired" ? 410 : reason === "unknown-visit" ? 404 : 400;
      return NextResponse.json(
        { ok: false, terminal: true, reason, hello: (result as Dict).hello === true },
        { status: code },
      );
    }

    // Notification last and best-effort: the visit is already committed, so a
    // mail failure only leaves the outbox row pending — it can never lose the visit.
    if ((result as Dict).notifyQueued === true) {
      const sessionId = String(body.id || "").slice(0, 40);
      try {
        if (await notifyLinkOpened(sessionId)) {
          await convexMutation(api.trails.outboxMarkBySession, {
            sessionId,
            status: "sent",
          }).catch(() => null);
        }
      } catch {
        // Left pending: the owner drain (POST /api/dashboard/trails-outbox)
        // retries it. Never fail the flush over mail.
      }
    }

    return NextResponse.json({
      ok: true,
      v: 2,
      seq: (result as Dict).seq ?? body.seq,
      tracked: (result as Dict).tracked === true,
      hello: (result as Dict).hello === true,
      status,
      ...((result as Dict).tailor ? { tailor: (result as Dict).tailor } : {}),
      ...((result as Dict).link ? { link: (result as Dict).link } : {}),
      // The collector clears stale link attribution on this flag; dropping it
      // here left revoked-code tabs holding a dead link's greeting.
      ...((result as Dict).linkDropped === true ? { linkDropped: true } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/Unauthorized/.test(msg))
      return NextResponse.json({ ok: false, terminal: false, reason: "unavailable" }, { status: 500 });
    return NextResponse.json({ ok: false, terminal: false, reason: "internal" }, { status: 500 });
  }
}

async function notifyLinkOpened(sessionId: string): Promise<boolean> {
  const to = process.env.OWNER_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) return false;
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const payload = await trailNotification(sessionId);
  const sent = await sendSafe(resend, {
    from: getResendFrom(), to, ...payload,
  }, { idempotencyKey: `trails-visit-${sessionId}` });
  if (sent.error || sent.skipped || !sent.id) throw new Error("Notification not delivered");
  return true;
}
