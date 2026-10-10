/**
 * JSON-LD builders (schema.org) for SEO + GEO.
 *
 * All builders are plain functions returning plain objects so they can be
 * rendered from any Server Component. Rules baked in here:
 *  - one canonical `@id` per entity, so entities are linkable across pages
 *    (the project pages reference the same Person `@id` the layout defines);
 *  - `@context`/`@graph` shaped exactly as Google's Rich Results Test expects;
 *  - `sameAs` uses the single PROFILES list, so handles can never disagree
 *    between the JSON-LD, the nav, the footer and llms.txt.
 */
import { siteConfig } from "@/lib/metadata";
import { KNOWS_ABOUT, ME, PORTRAIT, SAME_AS } from "@/data/me";
import type { Project, ProjectCategory } from "@/data/projects";

export const SITE_URL = siteConfig.url.replace(/\/$/, "");

export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const PROFILE_PAGE_ID = `${SITE_URL}/#profilepage`;

export const projectId = (project: Pick<Project, "id" | "href">): string =>
  `${SITE_URL}${project.href}#project`;

/** Prefix a site-relative path with the canonical origin. */
export const absolute = (path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

const personNode = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: ME.name,
  alternateName: ["Mohand Darwish", "@mohand_darwish", "mohandamged70m"],
  givenName: "Mohand",
  familyName: "Darwish",
  jobTitle: ME.role,
  description: ME.oneLiner,
  url: `${SITE_URL}/`,
  mainEntityOfPage: { "@id": PROFILE_PAGE_ID },
  image: {
    "@type": "ImageObject",
    url: absolute(PORTRAIT.src),
    contentUrl: absolute(PORTRAIT.src),
    width: PORTRAIT.width,
    height: PORTRAIT.height,
    caption: PORTRAIT.alt,
  },
  email: `mailto:${ME.email}`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Alexandria",
    addressCountry: ME.countryCode,
  },
  workLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Alexandria",
      addressCountry: ME.countryCode,
    },
  },
  knowsLanguage: ["en"],
  knowsAbout: [...KNOWS_ABOUT],
  sameAs: [...SAME_AS],
};

const websiteNode = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: `${SITE_URL}/`,
  name: siteConfig.name,
  // Google site-names fallback: if the preferred `name` isn't selected,
  // Google strongly considers `alternateName` entries in order — ending
  // with the lowercase hostname keeps the fallback on this site's own
  // domain instead of the shared `vercel.app` apex brand ("Vercel").
  // Derived from SITE_URL so it stays correct on a custom domain.
  // https://developers.google.com/search/docs/appearance/site-names
  alternateName: [new URL(SITE_URL).hostname.toLowerCase()],
  description: siteConfig.description,
  inLanguage: "en",
  author: { "@id": PERSON_ID },
  publisher: { "@id": PERSON_ID },
};

const profilePageNode = {
  "@type": "ProfilePage",
  "@id": PROFILE_PAGE_ID,
  url: `${SITE_URL}/`,
  name: `${ME.name} — ${ME.role}`,
  description: siteConfig.description,
  inLanguage: "en",
  isPartOf: { "@id": WEBSITE_ID },
  mainEntity: { "@id": PERSON_ID },
  about: { "@id": PERSON_ID },
  primaryImageOfPage: { "@id": `${SITE_URL}/#primaryimage` },
};

const primaryImageNode = {
  "@type": "ImageObject",
  "@id": `${SITE_URL}/#primaryimage`,
  url: absolute(PORTRAIT.src),
  contentUrl: absolute(PORTRAIT.src),
  width: PORTRAIT.width,
  height: PORTRAIT.height,
  caption: PORTRAIT.alt,
};

/**
 * Person + WebSite + ProfilePage, emitted once from the root layout so the
 * entity graph is identical on every route of the site.
 */
export function siteEntityGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [personNode, websiteNode, profilePageNode, primaryImageNode],
  };
}

/**
 * SoftwareApplication for one project. `applicationCategory` uses real
 * schema.org subtypes only (the Rich Results Test rejects invented values);
 * "Design System" and "Tooling" are engineering artefacts, so they map to
 * DeveloperApplication, and product-shaped work maps to BusinessApplication.
 */
const APPLICATION_CATEGORY: Record<ProjectCategory, string> = {
  Frontend: "DeveloperApplication",
  "Design System": "DeveloperApplication",
  Tooling: "DeveloperApplication",
  "Full-Stack": "BusinessApplication",
};

export function projectJsonLd(project: Project) {
  const url = absolute(project.href);
  const description =
    project.description?.trim() ||
    `${project.title} — a ${project.category.toLowerCase()} project by ${ME.name}.`;

  // sameAs collects every external canonical for the build (live demo, source).
  const sameAs = [project.liveUrl, project.githubUrl].filter(
    (u): u is string => typeof u === "string" && u.length > 0 && u !== "#"
  );

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": projectId(project),
    name: project.title,
    description,
    url,
    applicationCategory: APPLICATION_CATEGORY[project.category] ?? "DeveloperApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires a modern web browser with JavaScript enabled",
    inLanguage: "en",
    author: { "@id": PERSON_ID },
    creator: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID },
    isPartOf: { "@id": WEBSITE_ID },
    ...(project.image ? { image: absolute(project.image) } : {}),
    ...(project.year ? { datePublished: project.year } : {}),
    // Stack entries are technologies, not languages, so they land in
    // keywords rather than the (strictly language-valued) programmingLanguage.
    ...(project.stack?.length ? { keywords: project.stack.join(", ") } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(project.githubUrl ? { codeRepository: project.githubUrl } : {}),
    ...(project.problem ? { abstract: project.problem } : {}),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
}

export function breadcrumbJsonLd(items: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

/** ItemList of every project, for the /projects archive. */
export function projectListJsonLd(projects: readonly Project[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE_URL}/projects#itemlist`,
    name: `Projects by ${ME.name}`,
    numberOfItems: projects.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: projects.map((project, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absolute(project.href),
      name: project.title,
    })),
  };
}

/** CollectionPage wrapper for the /projects archive. */
export function projectsCollectionJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/projects#collection`,
    url: `${SITE_URL}/projects`,
    name: `Projects by ${ME.name}`,
    description: `The complete project archive of ${ME.name}, a software engineer and AI product builder based in ${ME.country}.`,
    inLanguage: "en",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": PERSON_ID },
    mainEntity: { "@id": `${SITE_URL}/projects#itemlist` },
  };
}
