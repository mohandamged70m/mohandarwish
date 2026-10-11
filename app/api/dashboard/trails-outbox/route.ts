import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexMutation, convexQuery } from "@/lib/convex";
import { isAdminRequest } from "@/lib/admin";
import { trailNotification } from "@/lib/trails-notification";
import { getResendFrom, sendSafe } from "@/lib/resend";

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
      convexQuery<OutboxRow[]>(api.trails.outboxDue, { limit: 50 }),
      convexQuery<OutboxRow[]>(api.trails.outboxRecent, {
        ...(linkCode ? { linkCode } : {}),
        limit: 50,
      }),
    ]);
    return NextResponse.json({
      pending: (due || []).length,
      pendingCapped: (due || []).length === 50,
      configured: !!process.env.OWNER_EMAIL && !!process.env.RESEND_API_KEY,
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
          ...await trailNotification(row.sessionId),
        },
        { idempotencyKey: `trails-visit-${row.sessionId}` },
      );
      if (result.error || result.skipped || !result.id) throw new Error(result.error || "Notification not delivered");
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
