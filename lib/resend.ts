import { Resend } from "resend";

export function getResendFrom(): string {
  // If you verified a domain at resend.com/domains, set RESEND_FROM="Mohand <hello@yourdomain.com>"
  // Otherwise Resend test mode requires onboarding@resend.dev as FROM
  return process.env.RESEND_FROM || "Mohand Darwish <onboarding@resend.dev>";
}

export function isResendTestModeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  // Resend SDK throws with message containing the API JSON
  return msg.includes("You can only send testing emails") || msg.includes("validation_error");
}

export async function sendSafe(
  resend: Resend,
  params: { from: string; to: string; subject: string; html: string; replyTo?: string }
): Promise<{ id?: string; skipped?: boolean; error?: string }> {
  try {
    const result = await resend.emails.send(params as never);
    // SDK returns { data, error } in some versions; handle both
    const r = result as unknown as { error?: unknown; data?: { id?: string }; id?: string };
    if (r?.error) {
      const e = r.error as { message?: string; name?: string };
      if (isResendTestModeError(e) || String(e?.message ?? "").includes("You can only send testing emails")) {
        console.warn(`[Resend] Test mode — skipped send to ${params.to} (verify domain at resend.com/domains to send to any recipient).`, e?.message);
        return { skipped: true, error: e?.message };
      }
      throw new Error(e?.message || "Resend error");
    }
    return { id: (r?.data as { id?: string })?.id ?? r?.id };
  } catch (err) {
    if (isResendTestModeError(err)) {
      console.warn(`[Resend] Test mode — skipped send to ${params.to}. Verify a domain at resend.com/domains and set RESEND_FROM to use that domain.`);
      return { skipped: true, error: String(err) };
    }
    console.error("[Resend] send failed", err);
    return { error: String(err) };
  }
}
