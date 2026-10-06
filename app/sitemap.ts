import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";
import { getProjectsServer } from "@/lib/projects-server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");
  // Stable date (not `new Date()` per request) so CDN + conditional
  // caching works. Bump only when content model changes; per-project
  // dates come from the DB when available.
  const staticDate = new Date("2026-09-08T00:00:00Z");

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: staticDate,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { en: `${base}/` } },
    },
    {
      url: `${base}/projects`,
      lastModified: staticDate,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: { en: `${base}/projects` } },
    },
  ];

  try {
    const projects = await getProjectsServer();
    for (const p of projects) {
      routes.push({
        url: `${base}${p.href}`,
        lastModified: staticDate,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages: { en: `${base}${p.href}` } },
      });
    }
  } catch {
    // sitemap stays valid with static routes only when DB is unreachable
  }

  return routes;
}
