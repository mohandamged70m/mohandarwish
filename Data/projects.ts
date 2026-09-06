export type ProjectCategory = "Frontend" | "Full-Stack" | "Design System" | "Tooling";
export type FilterCategory = "Projects" | "Developer";

export type ProjectTag = {
  name: string;
  color?: string;
  iconSvg?: string;
};

export type ProjectContributor = {
  name: string;
  role: string;
  image?: string;
  github?: string;
  linkedin?: string;
  portfolio?: string;
};

export type Project = {
  id: string;
  title: string;
  category: ProjectCategory;
  image: string;
  href: string;
  year?: string;
  stack?: string[];
  /** Full tag snapshots persisted in `Projects/<id>` (Stack + Tags). */
  tagsDetailed?: ProjectTag[];
  /** Full contributor snapshots persisted in `Projects/<id>`. */
  contributors?: ProjectContributor[];
  description?: string;
  problem?: string;
  role?: string;
  featured?: boolean;
  liveUrl?: string;
  githubUrl?: string;
  downloadUrl?: string;
  views?: number;
  metrics?: readonly { label: string; value: string }[];
  highlights?: readonly string[];
  images?: readonly string[];
  videos?: readonly string[];
  listing?: number;
};

export const FILTER_CATEGORIES: readonly FilterCategory[] = [
  "Projects",
  "Developer",
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

export type TagDirectory = Record<string, { Name?: string; Color?: string; Icon?: string }>;
export type ContributorDirectory = Record<
  string,
  { Name?: string; Role?: string; Image?: string; "Social Accounts"?: Record<string, string> }
>;

function toTagDetail(
  t: unknown,
  dir?: TagDirectory,
): ProjectTag | null {
  const name = typeof t === "string" ? t : (t as { Name?: string })?.Name ?? "";
  if (!name) return null;
  const color =
    (typeof t === "object" && t !== null && (t as { Color?: string }).Color) ||
    dirLookup(dir, name)?.Color ||
    undefined;
  const iconSvg =
    (typeof t === "object" && t !== null && (t as { Icon?: string }).Icon) ||
    dirLookup(dir, name)?.Icon ||
    undefined;
  return { name, ...(color ? { color } : {}), ...(iconSvg ? { iconSvg } : {}) };
}

function dirLookup(dir: TagDirectory | undefined, name: string) {
  if (!dir) return undefined;
  const lower = name.trim().toLowerCase();
  for (const v of Object.values(dir)) {
    if (typeof v?.Name === "string" && v.Name.trim().toLowerCase() === lower) return v;
  }
  return undefined;
}

function toContributorDetail(
  c: unknown,
  dir?: ContributorDirectory,
): ProjectContributor | null {
  const obj = (c ?? {}) as Record<string, unknown>;
  const name =
    (obj["Contributor Name"] as string) ||
    (obj.Name as string) ||
    (obj.name as string) ||
    "";
  if (!name) return null;
  const role =
    (obj["Role at Project"] as string) || (obj.Role as string) || (obj.role as string) || "Contributor";
  const embeddedSocials = (obj["Social Accounts"] as Record<string, string> | undefined) ?? {};
  const lower = name.trim().toLowerCase();
  const profile = dir
    ? Object.values(dir).find(
        (v) => typeof v?.Name === "string" && v.Name.trim().toLowerCase() === lower,
      )
    : undefined;
  const profileSocials = profile?.["Social Accounts"] ?? {};
  return {
    name,
    role,
    image: (obj.Image as string) || profile?.Image || undefined,
    github: embeddedSocials.Github || profileSocials.Github || undefined,
    linkedin: embeddedSocials.Linkedin || profileSocials.Linkedin || undefined,
    portfolio: embeddedSocials.Portfolio || profileSocials.Portfolio || undefined,
  };
}

export function mapDashboardDocToProject(
  docId: string,
  data: DashboardProjectRow,
  dirs?: { tags?: TagDirectory; contributors?: ContributorDirectory },
): Project {
  const title = docId;
  const description = typeof data.Description === "string" ? data.Description : "";
  const liveUrl = typeof data["Live Link"] === "string" ? data["Live Link"] : undefined;
  const githubUrl = typeof data["Repository Link"] === "string" ? data["Repository Link"] : undefined;
  const downloadUrl =
    typeof data["Download Link"] === "string" && data["Download Link"] ? data["Download Link"] : undefined;
  const icon = typeof data["Project Icon"] === "string" ? data["Project Icon"] : "";

  // Tags: prefer full Stack snapshots ({Name, Color, Icon}), fall back to the
  // legacy Tags map (numeric-string keys -> name). Enrich plain names via the
  // Tags/Tags directory when available.
  const rawStackList = Array.isArray(data.Stack)
    ? (data.Stack as unknown[])
    : data.Stack && typeof data.Stack === "object"
      ? Object.values(data.Stack as Record<string, unknown>)
      : [];
  const rawTagList = Array.isArray(data.Tags)
    ? (data.Tags as unknown[])
    : data.Tags && typeof data.Tags === "object"
      ? Object.values(data.Tags as Record<string, unknown>)
      : [];
  const detailedByName = new Map<string, ProjectTag>();
  for (const t of [...rawStackList, ...rawTagList]) {
    const d = toTagDetail(t, dirs?.tags);
    if (d && !detailedByName.has(d.name.toLowerCase())) detailedByName.set(d.name.toLowerCase(), d);
  }
  for (const n of toArrayStrings(data.Tags)) {
    if (!detailedByName.has(n.toLowerCase())) {
      const d = toTagDetail(n, dirs?.tags);
      if (d) detailedByName.set(n.toLowerCase(), d);
    }
  }
  const tagsDetailed = [...detailedByName.values()];
  const merged = tagsDetailed.map((t) => t.name);

  // Contributors: every entry persisted in the project doc (name + role +
  // image/socials snapshot), enriched via Tags/Contributors when available.
  const rawContribList = Array.isArray(data.Contributors)
    ? (data.Contributors as unknown[])
    : data.Contributors && typeof data.Contributors === "object"
      ? Object.values(data.Contributors as Record<string, unknown>)
      : [];
  const contributors = rawContribList
    .map((c) => toContributorDetail(c, dirs?.contributors))
    .filter((c): c is ProjectContributor => c !== null);

  const rawImages = Array.isArray(data["Project Images"])
    ? (data["Project Images"] as unknown[]).map((x) => String(x)).filter(Boolean)
    : toArrayStrings(data["Project Images"]);
  const videos = rawImages.filter(isVideoSrc);
  const images = rawImages.filter((s) => !isVideoSrc(s));

  const listingRaw = data.Listing ?? data.listing;
  const listing = Number(listingRaw) || 0;

  const viewsRaw =
    data.Views && typeof data.Views === "object"
      ? (data.Views as Record<string, unknown>).Project
      : data.Views;
  const views = Number(viewsRaw) || 0;

  const category = inferCategory(merged);
  const image = icon || images[0] || FALLBACK_IMAGE;

  return {
    id: docId,
    title,
    category,
    image,
    href: `/projects/${encodeURIComponent(docId)}`,
    stack: merged,
    tagsDetailed,
    contributors: contributors.length ? contributors : undefined,
    description,
    featured: listing > 0 ? listing <= 6 : true,
    liveUrl,
    githubUrl,
    downloadUrl,
    views,
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
