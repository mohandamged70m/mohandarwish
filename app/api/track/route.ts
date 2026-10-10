import { NextResponse } from "next/server";
import { convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { auth } from "@/auth";
import { isOwnerSession } from "@/lib/owner";
import { allowRequest } from "@/lib/rate-limit";
import { linkOpenedHtml } from "@/lib/email";
import { getResendFrom, sendSafe } from "@/lib/resend";
import { siteConfig } from "@/lib/metadata";

// Trails ingest gateway. The browser buffers a visit and POSTs immutable
// numbered batches here (lib/analytics/collect.ts); the single Convex
// mutation api.trails.applyFlush applies session + aggregates atomically.
// Ownership comes from the Auth.js session (HttpOnly) — never body.owner.
// Direct visits without a valid share-link code stay untracked by design.

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
        await notifyLinkOpened(result as Dict, body, edgeGeo(req));
        await convexMutation(api.trails.outboxMarkBySession, {
          sessionId,
          status: "sent",
        }).catch(() => null);
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/Unauthorized/.test(msg))
      return NextResponse.json({ ok: false, terminal: false, reason: "unavailable" }, { status: 500 });
    return NextResponse.json({ ok: false, terminal: false, reason: "internal" }, { status: 500 });
  }
}

async function notifyLinkOpened(result: Dict, body: Dict, geo: { Country: string; Code: string }) {
  const to = process.env.OWNER_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) return;
  const link = isObj(result.link) ? (result.link as Dict) : {};
  const hello = isObj(body.hello) ? (body.hello as Dict) : {};
  const device = isObj(hello.device) ? (hello.device as Dict) : {};
  const entry = isObj(hello.entry) ? (hello.entry as Dict) : {};
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const linkName = String(link.Name || "Someone").slice(0, 120);
  const linkFor = String(link.For || "your portfolio").slice(0, 120);
  const id = String(body.id || "").slice(0, 40);
  const site = siteConfig.url;
  await sendSafe(resend, {
    from: getResendFrom(),
    to,
    subject: `${linkName} opened your link`.replace(/[\r\n]+/g, " ").slice(0, 200),
    html: linkOpenedHtml({
      linkName,
      linkFor,
      country: geo?.Code ? `${geo.Country} (${geo.Code})` : "",
      device: [device.Type, device.OS, device.Browser].filter(Boolean).join(" - "),
      localTime: String(device.LocalTime || "").slice(0, 10),
      source: String(entry.Ref || "Direct").slice(0, 120),
      visit: 1,
      storyUrl: `${site}/dashboard?s=${encodeURIComponent(id)}`,
    }),
  });
}
