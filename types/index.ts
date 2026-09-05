// Shared dashboard data types (replaces the old root types module).
// Shapes reconstructed from dashboard/D-Projects, M-ProjectForm, D-Tags usage.

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
