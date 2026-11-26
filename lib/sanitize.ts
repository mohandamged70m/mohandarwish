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

const SVG_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'ellipse', 'defs', 'linearGradient', 'radialGradient', 'stop', 'title',
  'text', 'tspan',
]);
const SVG_ATTRS = new Set([
  'viewBox', 'xmlns', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'points', 'cx', 'cy', 'r', 'x', 'y',
  'width', 'height', 'rx', 'ry', 'transform', 'opacity', 'fill-opacity',
  'stroke-opacity', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits',
  'x1', 'y1', 'x2', 'y2', 'class', 'text-anchor', 'font-size',
]);
const VOID_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop']);
const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

/**
 * Allowlist-based SVG sanitiser. A regex cannot reliably parse HTML, so the
 * markup is parsed and rebuilt from known-safe tags and attributes instead.
 * On the server we return empty — icon SVGs are client-only.
 */
export function sanitizeSvg(input: string): string {
  if (!input || typeof input !== 'string' || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(input, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return '';
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') return '';

  const clean = (node: Element): string => {
    const tag = node.tagName;
    if (!SVG_TAGS.has(tag)) return '';
    const attrs = Array.from(node.attributes)
      .filter((attr) => {
        const name = attr.name;
        if (name.startsWith('on') || !SVG_ATTRS.has(name)) return false;
        const value = decodeEntities(attr.value).toLowerCase().replace(/\s+/g, '');
        return !/javascript:|vbscript:|data:text\/html|data:image\/svg|data:application/.test(value);
      })
      .map((attr) => ` ${attr.name}="${escapeXml(attr.value)}"`)
      .join('');
    const children = Array.from(node.childNodes)
      .map((child) => {
        if (child.nodeType === 1) return clean(child as Element);
        if (child.nodeType === 3) return escapeXml(child.textContent ?? '');
        return '';
      })
      .join('');
    return VOID_TAGS.has(tag)
      ? `<${tag}${attrs}/>`
      : `<${tag}${attrs}>${children}</${tag}>`;
  };

  return clean(root);
}

export function sanitizeText(input: unknown, max = 2000): string {
  if (typeof input !== "string") return "";
  // Strip ASCII control chars (keep \t \n), collapse nothing else.
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}