// Minimal sanitizers (replaces the old lib/sanitize).
// `sanitizeSvg` is for tag/contributor icons. `sanitizeText` is for contact/
// booking free-text: strips control chars + caps length (HTML-escaping happens
// at render via `escHtml` in lib/email.ts, so we never store entities here).

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => {
      const cp = parseInt(h, 16);
      return Number.isFinite(cp) ? String.fromCharCode(cp) : "";
    })
    .replace(/&#(\d+);?/g, (_, d) => {
      const cp = parseInt(d, 10);
      return Number.isFinite(cp) ? String.fromCharCode(cp) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

export function sanitizeSvg(input: string): string {
  if (!input || typeof input !== "string") return "";
  let out = input;
  // Remove dangerous elements entirely (including self-closing forms).
  out = out.replace(
    /<(script|foreignObject|iframe|object|embed|base|meta|link)\b[\s\S]*?<\/\1\s*>/gi,
    "",
  );
  out = out.replace(
    /<(script|foreignObject|iframe|object|embed|base|meta|link)\b[^>]*\/?>/gi,
    "",
  );
  // Strip event handlers and dangerous URL attributes. Attribute values are
  // entity-decoded before the dangerous-URL check so encoded bypasses
  // (`&#106;avascript:`, `&#x6a;avascript:`) are caught too. Unquoted values
  // are handled by the same regex (third alternation).
  out = out.replace(
    /(\s+)([a-zA-Z:._-]+)(\s*=\s*)("([^"]*)"|'([^']*)'|([^\s>]+))/g,
    (match, ws, name, eq, _val, dq, sq, uq) => {
      const value = dq ?? sq ?? uq ?? "";
      const decoded = decodeEntities(value);
      const lowered = decoded.toLowerCase().replace(/\s+/g, "");
      if (/^on/i.test(name)) return "";
      if (
        /javascript:|vbscript:|data:text\/html|data:image\/svg\+xml|data:application/i.test(
          lowered,
        )
      )
        return "";
      return match;
    },
  );
  return out.trim();
}

export function sanitizeText(input: unknown, max = 2000): string {
  if (typeof input !== "string") return "";
  // Strip ASCII control chars (keep \t \n), collapse nothing else.
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}