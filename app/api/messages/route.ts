import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { EMAIL_RE } from "@/lib/booking";
import { emailTemplate, escHtml } from "@/lib/email";
import { Resend } from "resend";
import { getResendFrom, sendSafe } from "@/lib/resend";

export async function POST(req: Request) {
  let body: { name?: string; email?: string; message?: string; number?: string; hasWhatsapp?: boolean } | null = null;
  try {
    const json = await req.json();
    body = json as { name?: string; email?: string; message?: string; number?: string; hasWhatsapp?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim() ?? "";
  const message = body?.message?.trim() ?? "";
  const number = body?.number?.trim() ?? "";
  const hasWhatsapp = !!body?.hasWhatsapp;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (!message || message.length < 10) return NextResponse.json({ error: "Message too short" }, { status: 400 });

  const supabase = supabaseServer();
  // rate limit: messages table global 30s
  try {
    const { data: last } = await supabase.from("messages").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.created_at && Date.now() - new Date(last.created_at).getTime() < 30_000) {
      return NextResponse.json({ error: "Please wait 30s before sending another message." }, { status: 429 });
    }
  } catch {}
  const { error } = await supabase.from("messages").insert({ name, email, number: number || null, has_whatsapp: hasWhatsapp, message, files: [] });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const owner = process.env.OWNER_EMAIL || "mohandamged70m@gmail.com";
    const from = getResendFrom();
    const html = emailTemplate(
      `New message from ${name}`,
      `<div><strong>${escHtml(name)}</strong> &lt;${escHtml(email)}&gt;</div><div style="margin-top:8px;white-space:pre-wrap">${escHtml(message)}</div>${number ? `<div style="margin-top:8px">Phone: ${escHtml(number)}${hasWhatsapp ? " (WhatsApp)" : ""}</div>` : ""}`
    );
    const ack = emailTemplate("Message received", `<div>Hi ${escHtml(name)}, thanks for reaching out — I'll get back within 24h.</div>`);
    void (async () => {
      const a = await sendSafe(resend, { from, to: owner, subject: `New message: ${name}`, html, replyTo: email });
      const b = await sendSafe(resend, { from, to: email, subject: "Message received", html: ack });
      if (a.skipped || b.skipped) console.log("[messages] saved but email skipped (Resend test mode) — verify domain at resend.com/domains");
    })();
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("admin");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = supabaseServer();
  const { data, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}
