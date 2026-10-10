import { isAdminRequest } from "@/lib/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getResendFrom } from "@/lib/resend";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

// Callable: sendReceipt — { to, subject, html, meta:{receiptNo,currency,total,balance,projectIds,projectNames} }
// Sends via Resend, then appends the sent-receipt row to Treasury/receipts
// (the dashboard_docs doc the Treasury tab reads).

const checkAuth = isAdminRequest;

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    to?: string;
    subject?: string;
    html?: string;
    meta?: {
      receiptNo?: string;
      currency?: string;
      total?: number;
      balance?: number;
      projectIds?: string[];
      projectNames?: string[];
    };
  } | null;
  if (!body?.to || !body?.subject || !body?.html) {
    return NextResponse.json({ error: "to, subject, html required" }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const resend = new Resend(key);
  const { error } = (await resend.emails.send({
    from: getResendFrom(),
    to: body.to,
    subject: body.subject,
    html: body.html,
  } as never)) as { error?: { message?: string } };
  if (error) return NextResponse.json({ error: error.message || "Send failed" }, { status: 502 });

  // Log to Treasury/receipts history (best-effort; email already sent).
  try {
    const meta = body.meta ?? {};
    const doc = (await convexQuery<Record<string, unknown> | null>(api.docs.getDoc, { path: "Treasury/receipts" })) ?? {};
    const entries = ((doc.entries as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    const id = meta.receiptNo || `r_${Date.now().toString(36)}`;
    entries[id] = {
      to: body.to,
      via: "dashboard",
      projectIds: meta.projectIds ?? [],
      projectNames: meta.projectNames ?? [],
      receiptNo: meta.receiptNo ?? id,
      total: meta.total ?? 0,
      currency: meta.currency ?? "USD",
      balance: meta.balance ?? 0,
      sentAt: Date.now(),
    };
    await convexMutation(api.docs.setDoc, { path: "Treasury/receipts", data: { ...doc, entries } });
  } catch {
    // history is a nice-to-have
  }

  return NextResponse.json({ ok: true });
}
