/**
 * Where a visit came from, and which social network a click left for.
 *
 * Server-side only (used by app/api/track). This is the one point every writer
 * passes through, so the folding done here cannot be undone by a caller: one
 * spelling per network, one name per origin, regardless of how the browser
 * spelled it.
 */

/** One spelling per social network. */
const SOCIAL_NAMES: Record<string, string> = {
  github: "GitHub", gitlab: "GitLab", linkedin: "LinkedIn", instagram: "Instagram",
  facebook: "Facebook", threads: "Threads", tiktok: "TikTok", youtube: "YouTube",
  twitter: "Twitter", x: "X", behance: "Behance", dribbble: "Dribbble",
  medium: "Medium", whatsapp: "WhatsApp", telegram: "Telegram", discord: "Discord",
  pinterest: "Pinterest", reddit: "Reddit", twitch: "Twitch", spotify: "Spotify",
  email: "Email", mail: "Email",
};

/**
 * One document per network, not one per spelling.
 *
 * The name arrives from whatever the site had stored for that link, and the two
 * places that render social links read it from different documents - so the same
 * network arrived as both "GitHub" and "Github", and as both "LinkedIn" and
 * "Linkedin". Each spelling opened its own counter document and the real click
 * count was split between them.
 */
export function canonicalSocial(name: string): string {
  const known = SOCIAL_NAMES[name.trim().toLowerCase()];
  if (known) return known;
  // Unknown network: Title Case it so at least one casing wins consistently.
  return name
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export type SourceKind = "ai" | "search" | "social" | "mail" | "referral" | "direct";

/**
 * Host patterns, most specific first: copilot before bing, gemini before google.
 */
const SOURCE_HOSTS: Array<[RegExp, string, SourceKind]> = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "ChatGPT", "ai"],
  [/(^|\.)claude\.ai$|(^|\.)anthropic\.com$/, "Claude", "ai"],
  [/(^|\.)perplexity\.ai$/, "Perplexity", "ai"],
  [/^(gemini|bard|aistudio)\.google\.com$/, "Gemini", "ai"],
  [/(^|\.)copilot\.microsoft\.com$|(^|\.)copilot\.cloud\.microsoft$/, "Copilot", "ai"],
  [/(^|\.)grok\.com$|(^|\.)x\.ai$/, "Grok", "ai"],
  [/(^|\.)meta\.ai$/, "Meta AI", "ai"],
  [/(^|\.)deepseek\.com$/, "DeepSeek", "ai"],
  [/(^|\.)mistral\.ai$/, "Le Chat", "ai"],
  [/(^|\.)poe\.com$/, "Poe", "ai"],
  [/(^|\.)you\.com$/, "You.com", "ai"],
  [/(^|\.)phind\.com$/, "Phind", "ai"],
  [/(^|\.)t3\.chat$/, "T3 Chat", "ai"],
  [/(^|\.)kagi\.com$/, "Kagi", "search"],
  [/(^|\.)google\.[a-z.]{2,7}$/, "Google", "search"],
  [/(^|\.)bing\.com$/, "Bing", "search"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo", "search"],
  [/(^|\.)ecosia\.org$/, "Ecosia", "search"],
  [/(^|\.)search\.brave\.com$/, "Brave Search", "search"],
  [/(^|\.)yandex\.[a-z.]{2,7}$/, "Yandex", "search"],
  [/(^|\.)baidu\.com$/, "Baidu", "search"],
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, "LinkedIn", "social"],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)t\.co$/, "X", "social"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/, "Facebook", "social"],
  [/(^|\.)instagram\.com$/, "Instagram", "social"],
  [/(^|\.)threads\.(net|com)$/, "Threads", "social"],
  [/(^|\.)tiktok\.com$/, "TikTok", "social"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube", "social"],
  [/(^|\.)reddit\.com$/, "Reddit", "social"],
  [/(^|\.)t\.me$|(^|\.)telegram\.me$/, "Telegram", "social"],
  [/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/, "WhatsApp", "social"],
  [/(^|\.)discord\.(com|gg)$/, "Discord", "social"],
  [/(^|\.)pinterest\.[a-z.]{2,7}$/, "Pinterest", "social"],
  [/(^|\.)medium\.com$/, "Medium", "social"],
  [/(^|\.)behance\.net$/, "Behance", "social"],
  [/(^|\.)dribbble\.com$/, "Dribbble", "social"],
  [/(^|\.)github\.com$/, "GitHub", "referral"],
  [/(^|\.)stackoverflow\.com$/, "Stack Overflow", "referral"],
  [/(^|\.)news\.ycombinator\.com$/, "Hacker News", "referral"],
  [/(^|\.)producthunt\.com$/, "Product Hunt", "referral"],
  [/(^|\.)mail\.google\.com$/, "Gmail", "mail"],
  [/(^|\.)outlook\.(com|live|office)\.?[a-z]*$/, "Outlook", "mail"],
];

/** Bare utm_source words ("chatgpt", "linkedin") pointed at the host they mean. */
const SOURCE_WORDS: Record<string, string> = {
  chatgpt: "chatgpt.com", gpt: "chatgpt.com", openai: "openai.com",
  claude: "claude.ai", anthropic: "anthropic.com",
  perplexity: "perplexity.ai", gemini: "gemini.google.com", bard: "gemini.google.com",
  copilot: "copilot.microsoft.com", grok: "grok.com", deepseek: "deepseek.com",
  mistral: "mistral.ai", lechat: "mistral.ai", poe: "poe.com", meta: "meta.ai",
  google: "google.com", bing: "bing.com", duckduckgo: "duckduckgo.com", ddg: "duckduckgo.com",
  kagi: "kagi.com", brave: "search.brave.com", yandex: "yandex.com", baidu: "baidu.com",
  linkedin: "linkedin.com", twitter: "x.com", x: "x.com",
  facebook: "facebook.com", fb: "facebook.com", instagram: "instagram.com", ig: "instagram.com",
  threads: "threads.net", tiktok: "tiktok.com", youtube: "youtube.com", yt: "youtube.com",
  reddit: "reddit.com", telegram: "t.me", whatsapp: "wa.me", discord: "discord.com",
  pinterest: "pinterest.com", medium: "medium.com", behance: "behance.net",
  dribbble: "dribbble.com", github: "github.com", stackoverflow: "stackoverflow.com",
  hn: "news.ycombinator.com", hackernews: "news.ycombinator.com",
  producthunt: "producthunt.com", gmail: "mail.google.com", outlook: "outlook.com",
};

function matchSourceHost(host: string): [string, SourceKind] | null {
  for (const [re, name, kind] of SOURCE_HOSTS) {
    if (re.test(host)) return [name, kind];
  }
  return null;
}

/**
 * Resolve the visit's origin to one name and one kind.
 *
 * A referrer host is no longer the whole answer. Assistants are the reason: some
 * arrive with no referrer at all and nothing but ?utm_source=chatgpt.com to go on,
 * some send a referrer naming the company rather than the surface, and the same
 * origin reaches us spelled three ways across the two. So the query string is read
 * first, the referrer second, and both fold onto one canonical name - one row for
 * ChatGPT, not one each for "chatgpt.com", "chat.openai.com" and "openai".
 *
 * Kind is what the name is FOR. "ai" is the interesting one - someone asked an
 * assistant and it sent them here - kept apart from ordinary search, social and
 * plain links so it can be counted on its own.
 */
export function classifySource(entry: {
  Ref?: string;
  Referrer?: string;
  Utm?: Record<string, string>;
}): { Name: string; Kind: SourceKind } {
  const utm = entry.Utm && typeof entry.Utm === "object" ? entry.Utm : {};
  const medium = String(utm.medium || "").trim().toLowerCase();

  // What the LINK claims beats what the browser reports: an assistant that strips
  // the referrer still tags the URL, and that tag is the only thing naming it.
  let token = String(utm.source || utm.ref || "").trim().toLowerCase();
  if (!token) token = String(entry.Ref || "").trim().toLowerCase();
  if (!token) token = String(entry.Referrer || "").trim().toLowerCase();
  if (!token && utm.gclid) token = "google.com";
  if (!token && utm.fbclid) token = "facebook.com";

  if (!token) return { Name: "Direct", Kind: "direct" };
  if (token === "email" || token === "newsletter" || medium === "email") {
    return { Name: token === "newsletter" ? "Newsletter" : "Email", Kind: "mail" };
  }

  const host = (SOURCE_WORDS[token.replace(/[^a-z0-9.]/g, "")] || token).replace(/^www\./, "");
  const hit = matchSourceHost(host);
  if (hit) return { Name: hit[0], Kind: hit[1] };

  // Nothing we have a name for: keep the host as it is, so it is still one row per
  // origin, and Title Case a bare word so casing cannot split it in two.
  const name = host.includes(".")
    ? host.slice(0, 60)
    : host.replace(/(^|[\s-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase()).slice(0, 60);
  return name ? { Name: name, Kind: "referral" } : { Name: "Direct", Kind: "direct" };
}