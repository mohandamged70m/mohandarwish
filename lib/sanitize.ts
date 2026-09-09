// Minimal sanitizers (replaces the old lib/sanitize).
// `sanitizeSvg` is for tag/contributor icons. `sanitizeText` is for contact/
// booking free-text: strips control chars + caps length (HTML-escaping happens
// at render via `escHtml` in lib/email.ts, so we never store entities here).

export function sanitizeSvg(input: string): string {
  if (!input || typeof input !== "string") return "";
  let out = input.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
  out = out.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "");
  // event handler attributes: onload=... onclick="..." etc.
  out = out.replace(/\s+on[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, "");
  // javascript: / data:text/html URLs in href/xlink:href/src
  out = out.replace(/\s+(href|xlink:href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|"data:text\/html[^"]*"|'data:text\/html[^']*')/gi, "");
  return out.trim();
}

export function sanitizeText(input: unknown, max = 2000): string {
  if (typeof input !== "string") return "";
  // Strip ASCII control chars (keep \t \n), collapse nothing else.
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
