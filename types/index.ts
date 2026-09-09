// Shared dashboard data types (replaces the old root types module).
// Shapes reconstructed from dashboard/D-Projects, M-ProjectForm, D-Tags usage.
//
// Ownership (fix, not delete):
// - `Data/projects.ts` is canonical for SITE (string-only) types:
//   `Project`, `ProjectTag`, `ProjectContributor` — what visitors see.
// - This file is canonical for DASHBOARD FORM types (allow `File` uploads):
//   `TagData`, `ContributorData`, `ProjectData`, `*FormData`.
// They intentionally differ (File vs string). Re-exports below keep both
// worlds importable from either path without duplicating definitions.

export interface TagData {
  id?: string | number;
  name: string;
  color?: string;
  iconSvg?: string;
}

export interface TagFormData {
  id?: string | number;
  name: string;
  color?: string;
  iconSvg?: string;
  iconFile?: File;
}

export interface ContributorSocials {
  github: string;
  linkedin: string;
  facebook: string;
  instagram: string;
  portfolio: string;
}

export interface ContributorData {
  id?: string | number;
  name: string;
  role: string;
  image?: string | File;
  socials?: Partial<ContributorSocials>;
  links?: Record<string, string | undefined>;
  jobTitle?: string;
}

export interface ProjectData {
  id?: string | number;
  name: string;
  description: string;
  tags: TagData[];
  contributors: ContributorData[];
  repoLink: string;
  liveLink: string;
  downloadLink?: string;
  images: (string | File)[];
  icon?: string | File;
  listing?: number;
  views?: number;
  githubViews?: number;
  liveViews?: number;
  downloadViews?: number;
  stack?: string[];
  title?: string;
}

export interface ProjectFormData extends Omit<ProjectData, "images" | "icon"> {
  images: (File | string)[];
  icon?: File | string;
}

// --- Bridge to site types (no duplication): import site shapes from here
// so dashboard code can convert form -> site without a second import path.
export type {
  Project as SiteProject,
  ProjectTag as SiteTag,
  ProjectContributor as SiteContributor,
  ProjectCategory as SiteCategory,
} from "@/Data/projects";
