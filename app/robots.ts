import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

/**
 * AI / answer-engine crawlers explicitly welcomed on public content (GEO).
 *
 * `GPTBot` trains OpenAI models, `OAI-SearchBot` powers ChatGPT search
 * citations, `ChatGPT-User` is on-demand user-triggered fetching, `ClaudeBot`
 * and `Claude-User` cover Anthropic, `Claude-SearchBot` backs Claude's search
 * citations, `PerplexityBot` backs Perplexity, `Google-Extended` controls
 * Gemini/AI Overviews grounding, and `Applebot-Extended` covers Apple
 * Intelligence. Naming them individually (rather than relying on `*`) is a
 * deliberate signal: the content here is meant to be read and cited.
 */
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Applebot",
  "meta-externalagent",
  "cohere-ai",
  "cohere-training-data-crawler",
  "YouBot",
  "Diffbot",
  "Bytespider",
  "Amazonbot",
  "CCBot",
];

/** Private / non-content routes. Same list for every crawler, AI or classic. */
const PRIVATE_PATHS = ["/dashboard", "/api/", "/mohanddarwish/"];

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        // AI answer engines get the same private-path protections as everyone
        // else: the portfolio is public, the dashboard and APIs are not.
        userAgent: AI_BOTS,
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
