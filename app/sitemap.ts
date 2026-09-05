import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/metadata";
import { getProjectsServer } from "@/lib/projects-server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();
  const routes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/projects`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ];
  try {
    const projects = await getProjectsServer();
    for (const p of projects) {
      routes.push({ url: `${base}${p.href}`, lastModified: now, changeFrequency: "monthly", priority: 0.6 });
    }
  } catch {
    // sitemap stays valid with static routes only when DB is unreachable
  }
  return routes;
}
