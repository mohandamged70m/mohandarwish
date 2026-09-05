// Minimal SVG sanitizer (replaces the old lib/sanitize).
// Strips scripts, event-handler attributes, javascript: URLs and foreignObject.

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
