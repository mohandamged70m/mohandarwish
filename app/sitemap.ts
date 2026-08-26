import type { MetadataRoute } from "next";
import { PROJECTS } from "@/Data/projects";
import { siteConfig } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/projects`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ];
  for (const p of PROJECTS) {
    routes.push({ url: `${base}${p.href}`, lastModified: now, changeFrequency: "monthly", priority: 0.6 });
  }
  return routes;
}
