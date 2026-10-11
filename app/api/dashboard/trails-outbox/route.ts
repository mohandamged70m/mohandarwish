import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexMutation, convexQuery } from "@/lib/convex";
import { isAdminRequest } from "@/lib/admin";
import { linkOpenedHtml } from "@/lib/email";
import { getResendFrom, sendSafe } from "@/lib/resend";
import { siteConfig } from "@/lib/metadata";

// Owner-triggered notification drain. POST retries every due link-open email
// (pending plus failed with attempts left, bounded per call); GET reports the
// backlog and recent per-link status for the dashboard. Inline sends on
// /api/track already mark rows sent — this only covers what failed there, so
// a mail outage delays the email without losing the visit.

export const dynamic = "force-dynamic";

interface OutboxRow {
  _id: string;
  sessionId: string;
  linkCode: string;
  linkName: string;
  status: string;
  attempts: number;
  createdAt: number;
}

export async function GET(req: Request) {
  if (!(await isAdminRequest(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const linkCode = url.searchParams.get("linkCode") || undefined;
    const [due, recent] = await Promise.all([
      convexQuery<OutboxRow[]>(api.trails.outboxDue, { limit: 1 }),
      convexQuery<OutboxRow[]>(api.trails.outboxRecent, {
        ...(linkCode ? { linkCode } : {}),
        limit: 50,
      }),
    ]);
    return NextResponse.json({
      pending: (due || []).length,
      recent: (recent || []).map((r) => ({
        linkCode: r.linkCode,
        linkName: r.linkName,
        sessionId: r.sessionId,
        status: r.status,
        attempts: r.attempts,
        createdAt: r.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const to = process.env.OWNER_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!to || !key)
    return NextResponse.json(
      { ok: false, reason: "notifications-unconfigured" },
      { status: 200 },
    );
  let rows: OutboxRow[] = [];
  try {
    rows = (await convexQuery<OutboxRow[]>(api.trails.outboxDue, { limit: 10 })) || [];
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      // Stable key per outbox row: a crashed drain that already sent retries
      // as a provider-side no-op instead of a second email.
      const result = await sendSafe(
        resend,
        {
          from: getResendFrom(),
          to,
          subject: `${row.linkName || "Someone"} opened your link`
            .replace(/[\r\n]+/g, " ")
            .slice(0, 200),
          html: linkOpenedHtml({
            linkName: (row.linkName || "Someone").slice(0, 120),
            linkFor: "your portfolio",
            country: "",
            device: "",
            localTime: "",
            source: "Direct",
            visit: 1,
            storyUrl: `${siteConfig.url}/dashboard?s=${encodeURIComponent(row.sessionId)}`,
          }),
        },
        { idempotencyKey: `trails-outbox-${row._id}` },
      );
      if (result.error && !result.skipped) throw new Error(result.error);
      await convexMutation(api.trails.outboxMark, { id: row._id as never, status: "sent" });
      sent++;
    } catch (e) {
      failed++;
      await convexMutation(api.trails.outboxMark, {
        id: row._id as never,
        status: "failed",
        error: e instanceof Error ? e.message : "send failed",
      }).catch(() => null);
    }
  }
  return NextResponse.json({ ok: true, sent, failed, remaining: Math.max(0, rows.length - sent - failed) });
}
