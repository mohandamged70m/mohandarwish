/** Largest distance a candidate may have and still count as a search hit. */
export const SEARCH_MAX_DISTANCE = 3;

const NO_MATCH = 1_000_000;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        row[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

function scoreOne(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const h = text.toLowerCase();
  if (!q) return 0;
  if (!h) return NO_MATCH;
  if (h.includes(q)) return 0;

  let best = NO_MATCH;
  // Whole words catch typos ("protfolio" -> "portfolio").
  for (const word of h.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (word.length >= Math.max(2, q.length - 2)) best = Math.min(best, levenshtein(q, word));
  }
  // Sliding windows catch multi-word candidates.
  for (let i = 0; i + q.length <= h.length; i++) {
    best = Math.min(best, levenshtein(q, h.slice(i, i + q.length)));
  }
  return best;
}

/**
 * Best (lowest) fuzzy distance from `a` to `b`. ProjectsTab passes a query and
 * a list of candidates (a project name plus its tags), so `b` may be either a
 * single string or an array. A value >= SEARCH_MAX_DISTANCE means no match.
 */
export function bestDistance(a: string, b: string | string[]): number {
  const candidates = Array.isArray(b) ? b : [b];
  let best = NO_MATCH;
  for (const candidate of candidates) {
    best = Math.min(best, scoreOne(a, String(candidate ?? "")));
    if (best === 0) break;
  }
  return best;
}
