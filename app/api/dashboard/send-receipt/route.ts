import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getResendFrom } from "@/lib/resend";
import { supabaseServer } from "@/lib/supabase/server";

// Callable: sendReceipt — { to, subject, html, meta:{receiptNo,currency,total,balance,projectIds,projectNames} }
// Sends via Resend, then appends the sent-receipt row to Treasury/receipts
// (the dashboard_docs doc the Treasury tab reads).

function checkAuth(req: Request): boolean {
  const token = req.headers.get("x-admin-token");
  return !!process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN;
}

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
    const supabase = supabaseServer();
    const { data } = await supabase.from("dashboard_docs").select("data").eq("path", "Treasury/receipts").maybeSingle();
    const doc = ((data?.data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
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
    await supabase.from("dashboard_docs").upsert(
      { path: "Treasury/receipts", data: { ...doc, entries }, updated_at: new Date().toISOString() },
      { onConflict: "path" }
    );
  } catch {
    // history is a nice-to-have
  }

  return NextResponse.json({ ok: true });
}
