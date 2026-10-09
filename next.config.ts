import type { NextConfig } from "next";

/**
 * Bots that must receive the *complete* HTML document, not a streamed shell.
 *
 * By default Next.js only blocking-renders for its own HTML-limited list
 * (Google, Bing, Twitterbot, Slackbot…). Everything else — which today means
 * GPTBot, ClaudeBot, PerplexityBot, Applebot-Extended and friends — gets the
 * streamed response. The home page streams its below-the-fold sections
 * (`<Suspense>` boundaries), so those crawlers were receiving a shell without
 * the projects, stack, FAQ or any of the JSON-LD. That is the single biggest
 * GEO defect this config fixes: the AI crawlers now get the same fully
 * assembled document Google does.
 *
 * The first alternative is Next.js's own default list, preserved verbatim so
 * overriding the option changes nothing for existing engines.
 */
const HTML_LIMITED_BOTS =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User|Google-Extended|Applebot-Extended|CCBot|Amazonbot|meta-externalagent|cohere-ai|YouBot|Bytespider|Diffbot/i;

const nextConfig: NextConfig = {
  htmlLimitedBots: HTML_LIMITED_BOTS,
  images: {
    // AVIF is smallest but slow to encode — fine in production (cached at
    // the edge) but painful in dev where each image optimizes on demand.
    // Dev uses WebP-only (fast encode); production gets AVIF first.
    // Same pixels either way, no visual change.
    formats:
      process.env.NODE_ENV === "development"
        ? ["image/webp"]
        : ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "cdn.simpleicons.org" },
      { protocol: "https", hostname: "svgl.app" },
      { protocol: "https", hostname: "*.convex.cloud" },
    ],
  },
  experimental: {
    // Per docs/01-app/02-guides/package-bundling.md + optimizePackageImports.md:
    // only loads actually-used modules. lucide-react/recharts already
    // optimized by default; motion is the landing-critical one to add.
    optimizePackageImports: [
      "motion",
      "@vercel/analytics",
      "recharts",
      "animejs",
      "matter-js",
      "lottie-react",
      "react-icons",
    ],
  },
  allowedDevOrigins: [],
};

export default nextConfig;
