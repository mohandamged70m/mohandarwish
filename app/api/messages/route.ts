import { allowRequest } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { isAdminRequest } from "@/lib/admin";
import { NextResponse } from "next/server";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { EMAIL_RE } from "@/lib/booking";
import { emailTemplate, escHtml } from "@/lib/email";
import { Resend } from "resend";
import { getResendFrom, sendSafe } from "@/lib/resend";
import { toMessage } from "@/lib/convex-map";

export async function POST(req: Request) {
  let body: {
    name?: string;
    email?: string;
    message?: string;
    number?: string;
    hasWhatsapp?: boolean;
    files?: { name: string; url: string }[];
  } | null = null;
  try {
    const json = await req.json();
    body = json as {
      name?: string;
      email?: string;
      message?: string;
      number?: string;
      hasWhatsapp?: boolean;
      files?: { name: string; url: string }[];
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = sanitizeText(body?.name, 120);
  const email = body?.email?.trim() ?? "";
  const message = sanitizeText(body?.message, 5000);
  const number = body?.number?.trim() ?? "";
  const hasWhatsapp = !!body?.hasWhatsapp;
  const files = Array.isArray(body?.files)
    ? body!.files!.slice(0, 5).filter((f) => {
        try {
          const u = new URL(f.url);
          return (
            typeof f.name === "string" &&
            u.protocol === "https:" &&
            u.origin ===
              new URL(
                process.env.NEXT_PUBLIC_CONVEX_URL ||
                  "https://unconfigured.invalid",
              ).origin &&
            u.pathname.startsWith("/api/storage/")
          );
        } catch {
          return false;
        }
      })
    : [];
  if (!name)
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!email || !EMAIL_RE.test(email))
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 },
    );
  if (!message || message.length < 10)
    return NextResponse.json({ error: "Message too short" }, { status: 400 });

  try {
    if (!(await allowRequest(req, "contact")))
      return NextResponse.json(
        { error: "Please try again later" },
        { status: 429 },
      );
    const id = await convexMutation(api.messages.create, {
      name,
      email,
      number: number || undefined,
      hasWhatsapp,
      message,
      files,
    });
    if (!id) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Your message could not be saved. Please try again." },
      { status: 503 },
    );
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const owner = process.env.OWNER_EMAIL || "mohandamged70m@gmail.com";
    const from = getResendFrom();
    const filesHtml = files.length
      ? `<div style="margin-top:12px"><strong>Attachments:</strong> ${files.map((f) => (f.url ? `<a href="${escHtml(f.url)}" style="color:#3395ff">${escHtml(f.name)}</a>` : escHtml(f.name))).join(", ")}</div>`
      : "";
    const html = emailTemplate(
      `New message from ${name}`,
      `<div><strong>${escHtml(name)}</strong> &lt;${escHtml(email)}&gt;</div><div style="margin-top:8px;white-space:pre-wrap">${escHtml(message)}</div>${number ? `<div style="margin-top:8px">Phone: ${escHtml(number)}${hasWhatsapp ? " (WhatsApp)" : ""}</div>` : ""}${filesHtml}`,
    );
    const ack = emailTemplate(
      "Message received",
      `<div>Hi ${escHtml(name)}, thanks for reaching out — I'll get back within 24h.</div>`,
    );
    await (async () => {
      const a = await sendSafe(resend, {
        from,
        to: owner,
        subject: `New message: ${name}`,
        html,
        replyTo: email,
      });
      const b = await sendSafe(resend, {
        from,
        to: email,
        subject: "Message received",
        html: ack,
      });
      if (a.skipped || b.skipped)
        console.log(
          "[messages] saved but email skipped (Resend test mode) — verify domain at resend.com/domains",
        );
    })().catch((e) => console.error("[messages] notification failed", e));
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  if (!isAdminRequest(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await convexQuery<Record<string, unknown>[]>(
    api.messages.list,
    {},
  );
  return NextResponse.json({ messages: (rows ?? []).map(toMessage) });
}
