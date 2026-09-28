import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Cohere-ai",
  "YouBot",
  "Diffbot",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api/", "/mohanddarwish/"],
      },
      // AI answer engines and training crawlers are explicitly welcome on
      // public pages (GEO): portfolio content is meant to be cited.
      { userAgent: AI_BOTS, allow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
