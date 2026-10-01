export function escHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function emailTemplate(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:32px;background:#0a0a0a;font-family:Inter,system-ui,sans-serif;color:#f5f5f5">
  <div style="max-width:560px;margin:0 auto;background:#250902;border:1px solid #640d14;border-radius:8px;overflow:hidden">
    <div style="height:3px;background:linear-gradient(90deg,#ad2831,#800e13)"></div>
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
    ? `<a href="${escHtml(b.meetingLink)}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#ad2831;color:#fff7ed;text-decoration:none;border-radius:4px;font-weight:600;font-size:13px">Join Meet</a>`
    : "";
  return emailTemplate(
    `New booking: ${b.date} ${b.time}`,
    `<div><strong>${escHtml(b.name)}</strong> &lt;${escHtml(b.email)}&gt; booked <strong>${escHtml(b.date)} at ${escHtml(b.time)}</strong>.</div>
     ${b.reason ? `<div style="margin-top:8px">Reason: ${escHtml(b.reason)}</div>` : ""}
     ${linkBtn}
     <div style="margin-top:12px"><a href="mailto:${escHtml(b.email)}" style="color:#e8624a">Reply to guest</a></div>`
  );
}

export function bookingGuestHtml(b: { name: string; date: string; time: string; meetingLink?: string }): string {
  const linkBtn = b.meetingLink
    ? `<a href="${escHtml(b.meetingLink)}" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#ad2831;color:#fff7ed;text-decoration:none;border-radius:4px;font-weight:600;font-size:13px">Join Google Meet</a>`
    : "";
  return emailTemplate(
    "Your call is booked",
    `<div>Hi ${escHtml(b.name)}, your call is booked for <strong>${escHtml(b.date)} at ${escHtml(b.time)}</strong>.</div>
     ${linkBtn}
     <div style="margin-top:12px;color:#737373;font-size:12px">Add to calendar via the Meet invite sent to your email.</div>`
  );
}

// ── Trails: "someone just opened the link you made" ───────────────────

export interface LinkOpenedInfo {
  linkName: string;
  linkFor: string;
  country: string;
  device: string;
  localTime: string;
  source: string;
  visit: number;
  /** Deep link that reopens the dashboard on this exact visit. */
  storyUrl: string;
}

/**
 * Fires the moment a real visitor opens a share link, if that link has emails on.
 *
 * The button deep-links to the exact visit: the dashboard parks the id and reopens
 * on that story. Nothing in the URL is sensitive on its own - it is a session id,
 * useless without admin auth.
 */
export function linkOpenedHtml(i: LinkOpenedInfo): string {
  const rows: Array<[string, string]> = [
    ["Link", `${i.linkName} - ${i.linkFor}`],
    ["Where", i.country || "Unknown"],
    ["On", i.device || "Unknown"],
    ["Their time", i.localTime || "-"],
    ["Came from", i.source || "Direct"],
    ["Visit", i.visit > 1 ? `#${i.visit} - they have been here before` : "First time"],
  ];
  const infoRows = rows
    .map(
      ([label, value]) =>
        `<div style="display:flex;padding:10px 0;border-bottom:1px solid #1f1f1f">
           <div style="font-size:11px;font-weight:700;color:#737373;width:120px;flex-shrink:0;text-transform:uppercase;letter-spacing:0.08em">${escHtml(label)}</div>
           <div style="font-size:14px;color:#e5e5e5;overflow-wrap:anywhere">${escHtml(value)}</div>
         </div>`
    )
    .join("");

  return emailTemplate(
    `${i.linkName} opened your link`,
    `<div style="margin-bottom:16px">The link you made for <strong style="color:#f5f5f5">${escHtml(i.linkFor)}</strong> is being read right now.</div>
     ${infoRows}
     <div style="margin-top:24px;text-align:center">
       <a href="${escHtml(i.storyUrl)}" style="display:inline-block;padding:11px 22px;background:#ad2831;color:#fff7ed;text-decoration:none;border-radius:4px;font-weight:600;font-size:13px">Watch this visit</a>
     </div>
     <div style="margin-top:14px;color:#525252;font-size:12px;text-align:center">Opens the dashboard on this exact visit after you sign in.</div>`
  );
}
