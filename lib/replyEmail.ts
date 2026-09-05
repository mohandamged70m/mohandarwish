// Reply email builder (replaces the old lib/replyEmail).

export const DEFAULT_REPLY_SUBJECT = "Thanks for reaching out";

export interface ReplyQuote {
  name: string;
  message: string;
  at: number;
}

export interface ReplyHtmlArgs {
  toName: string;
  bodyText: string;
  quote?: ReplyQuote;
  attachmentNames: string[];
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildReplyHtml(args: ReplyHtmlArgs): string {
  const body = esc(args.bodyText).replace(/\n/g, "<br>");
  const quote = args.quote
    ? `<div style="margin:16px 0 0;padding:12px 14px;border-left:3px solid #3395ff;background:#f4f7fb;border-radius:0 8px 8px 0">` +
      `<div style="font-size:12px;color:#64748b;margin-bottom:6px">On ${esc(
        new Date(args.quote.at).toLocaleString()
      )}, ${esc(args.quote.name)} wrote:</div>` +
      `<div style="font-size:14px;color:#334155;white-space:pre-wrap">${esc(args.quote.message)}</div></div>`
    : "";
  const atts =
    args.attachmentNames.length > 0
      ? `<div style="margin-top:14px;font-size:13px;color:#64748b">Attachments: ${args.attachmentNames
          .map(esc)
          .join(", ")}</div>`
      : "";
  return (
    `<!doctype html><html><body style="font-family:sans-serif;line-height:1.6;color:#0f172a">` +
    `<p>Hi ${esc(args.toName)},</p><div>${body || "<br>"}</div>${quote}${atts}` +
    `<p style="margin-top:20px">— Mohand</p></body></html>`
  );
}
