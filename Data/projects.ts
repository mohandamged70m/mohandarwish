export type ProjectCategory = "Frontend" | "Full-Stack" | "Design System" | "Tooling";
export type FilterCategory = "Best Works" | ProjectCategory;

export type Project = {
  id: string;
  title: string;
  category: ProjectCategory;
  image: string;
  href: string;
  year?: string;
  stack?: string[];
  description?: string;
  problem?: string;
  role?: string;
  featured?: boolean;
  liveUrl?: string;
  githubUrl?: string;
  metrics?: readonly { label: string; value: string }[];
  highlights?: readonly string[];
  images?: readonly string[];
  videos?: readonly string[];
  listing?: number;
};

export const FILTER_CATEGORIES: readonly FilterCategory[] = [
  "Best Works",
  "Frontend",
  "Full-Stack",
  "Design System",
  "Tooling",
] as const;

const CATEGORIES: readonly ProjectCategory[] = [
  "Frontend",
  "Full-Stack",
  "Design System",
  "Tooling",
] as const;

const FALLBACK_IMAGE = "/me/mohand-darwish.jpeg";

function isVideoSrc(src: string): boolean {
  const clean = src.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov)$/.test(clean) || src.includes("/videos/");
}

function toArrayStrings(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).map((x) => String(x)).filter(Boolean);
  return [];
}

function inferCategory(stack: string[]): ProjectCategory {
  for (const name of stack) {
    const hit = CATEGORIES.find((c) => c.toLowerCase() === name.trim().toLowerCase());
    if (hit) return hit;
  }
  return "Full-Stack";
}

/** Raw dashboard_docs row data for path `Projects/<name>` (see D-Projects handleSaveProject). */
export type DashboardProjectRow = {
  Description?: unknown;
  "Live Link"?: unknown;
  "Download Link"?: unknown;
  "Project Icon"?: unknown;
  "Repository Link"?: unknown;
  Tags?: unknown;
  Stack?: unknown;
  Contributors?: unknown;
  "Project Images"?: unknown;
  Views?: unknown;
  Listing?: unknown;
  listing?: unknown;
};

export function mapDashboardDocToProject(docId: string, data: DashboardProjectRow): Project {
  const title = docId;
  const description = typeof data.Description === "string" ? data.Description : "";
  const liveUrl = typeof data["Live Link"] === "string" ? data["Live Link"] : undefined;
  const githubUrl = typeof data["Repository Link"] === "string" ? data["Repository Link"] : undefined;
  const icon = typeof data["Project Icon"] === "string" ? data["Project Icon"] : "";

  const tagNames = toArrayStrings(data.Tags);
  // Handle string- and object-form ({Name, Color, Icon}) stack entries.
  const rawStack = data.Stack;
  let stack: string[] = [];
  if (Array.isArray(rawStack)) {
    stack = rawStack
      .map((t) => (typeof t === "string" ? t : (t as { Name?: string })?.Name ?? ""))
      .filter(Boolean);
  } else if (rawStack && typeof rawStack === "object") {
    stack = Object.values(rawStack as Record<string, unknown>)
      .map((t) => (typeof t === "string" ? t : (t as { Name?: string })?.Name ?? ""))
      .filter(Boolean);
  }
  const merged = Array.from(new Set([...tagNames, ...stack].filter(Boolean)));

  const rawImages = Array.isArray(data["Project Images"])
    ? (data["Project Images"] as unknown[]).map((x) => String(x)).filter(Boolean)
    : toArrayStrings(data["Project Images"]);
  const videos = rawImages.filter(isVideoSrc);
  const images = rawImages.filter((s) => !isVideoSrc(s));

  const listingRaw = data.Listing ?? data.listing;
  const listing = Number(listingRaw) || 0;

  const category = inferCategory(merged);
  const image = icon || images[0] || FALLBACK_IMAGE;

  return {
    id: docId,
    title,
    category,
    image,
    href: `/projects/${encodeURIComponent(docId)}`,
    stack: merged,
    description,
    featured: listing > 0 ? listing <= 6 : true,
    liveUrl,
    githubUrl,
    images: images.length ? images : icon ? [icon] : [],
    videos: videos.length ? videos : [],
    listing,
  };
}

export function sortProjects<T extends { listing?: number; title: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const al = a.listing && a.listing > 0 ? a.listing : 999999;
    const bl = b.listing && b.listing > 0 ? b.listing : 999999;
    if (al !== bl) return al - bl;
    return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  });
}

/** Decode a `/projects/[id]` param back to the dashboard doc id. */
export function decodeProjectId(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
