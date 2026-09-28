import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mohand Darwish — Software Engineer | AI Product Builder",
    short_name: "Mohand Darwish",
    description:
      "Mohand Darwish is a software engineer in Alexandria, Egypt, working worldwide. Next.js, TypeScript and Node.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
