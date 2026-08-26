import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "cdn.simpleicons.org" },
      { protocol: "https", hostname: "svgl.app" },
    ],
  },
  allowedDevOrigins: ["192.168.1.11"],
};

export default nextConfig;
