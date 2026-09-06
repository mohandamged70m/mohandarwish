import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getResendFrom } from "@/lib/resend";

// Callable: sendReply — { to, subject, html, attachments:[{name,url}], meta }
// Sends via Resend. Attachments are fetched server-side (best-effort); if a
// fetch fails the file link is appended to the body instead.

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
    attachments?: { name: string; url: string }[];
  } | null;
  if (!body?.to || !body?.subject || !body?.html) {
    return NextResponse.json({ error: "to, subject, html required" }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  let html = body.html;
  const files: { filename: string; content: Buffer }[] = [];
  for (const a of body.attachments ?? []) {
    if (!a?.url || !a?.name) continue;
    try {
      const r = await fetch(a.url);
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 18 * 1024 * 1024) throw new Error("too large");
      files.push({ filename: a.name, content: buf });
    } catch {
      html += `<p style="font-size:13px;color:#64748b">Attachment: <a href="${a.url}">${a.name}</a></p>`;
    }
  }

  const resend = new Resend(key);
  const { error } = (await resend.emails.send({
    from: getResendFrom(),
    to: body.to,
    subject: body.subject,
    html,
    attachments: files.length ? files : undefined,
  } as never)) as { error?: { message?: string } };

  if (error) return NextResponse.json({ error: error.message || "Send failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
