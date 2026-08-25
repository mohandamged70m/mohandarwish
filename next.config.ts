import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
  allowedDevOrigins: ["192.168.1.11"],
};

export default nextConfig;
