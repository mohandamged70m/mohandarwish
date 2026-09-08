import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    // Per docs/01-app/02-guides/package-bundling.md + optimizePackageImports.md:
    // only loads actually-used modules. lucide-react/recharts already
    // optimized by default; motion is the landing-critical one to add.
    optimizePackageImports: ["motion", "@vercel/analytics"],
  },
  allowedDevOrigins: ["192.168.1.11"],
};

export default nextConfig;
