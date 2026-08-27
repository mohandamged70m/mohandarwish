export function escHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function emailTemplate(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:32px;background:#0a0a0a;font-family:Inter,system-ui,sans-serif;color:#f5f5f5">
  <div style="max-width:560px;margin:0 auto;background:#151515;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden">
    <div style="height:3px;background:linear-gradient(90deg,#a3e635,#65a30d)"></div>
    <div style="padding:28px">
      <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#a1a1a1;margin-bottom:8px">Mohand Darwish</div>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.2;color:#f5f5f5">${escHtml(title)}</h1>
      <div style="color:#a1a1a1;font-size:14px;line-height:1.6">${bodyHtml}</div>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #1f1f1f;color:#737373;font-size:12px">Alexandria, Egypt · mohandamged70m@gmail.com</div>
    </div>
  </div></body></html>`;
}

export function bookingOwnerHtml(b: {
  name: string;
  email: string;
  date: string;
  time: string;
  reason?: string;
  meetingLink?: string;
}): string {
  const linkBtn = b.meetingLink
    ? `<a href="${escHtml(b.meetingLink)}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#a3e635;color:#0a0a0a;text-decoration:none;border-radius:9999px;font-weight:600;font-size:13px">Join Meet</a>`
    : "";
  return emailTemplate(
    `New booking: ${b.date} ${b.time}`,
    `<div><strong>${escHtml(b.name)}</strong> &lt;${escHtml(b.email)}&gt; booked <strong>${escHtml(b.date)} at ${escHtml(b.time)}</strong>.</div>
     ${b.reason ? `<div style="margin-top:8px">Reason: ${escHtml(b.reason)}</div>` : ""}
     ${linkBtn}
     <div style="margin-top:12px"><a href="mailto:${escHtml(b.email)}" style="color:#a3e635">Reply to guest</a></div>`
  );
}

export function bookingGuestHtml(b: { name: string; date: string; time: string; meetingLink?: string }): string {
  const linkBtn = b.meetingLink
    ? `<a href="${escHtml(b.meetingLink)}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#a3e635;color:#0a0a0a;text-decoration:none;border-radius:9999px;font-weight:600;font-size:13px">Join Google Meet</a>`
    : "";
  return emailTemplate(
    "Your call is booked",
    `<div>Hi ${escHtml(b.name)}, your call is booked for <strong>${escHtml(b.date)} at ${escHtml(b.time)}</strong>.</div>
     ${linkBtn}
     <div style="margin-top:12px;color:#737373;font-size:12px">Add to calendar via the Meet invite sent to your email.</div>`
  );
}
