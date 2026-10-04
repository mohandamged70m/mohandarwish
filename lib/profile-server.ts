import { convexQuery } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

export type ProfileExperience = {
  id: string;
  company: string;
  role: string;
  period: string;
  start_date: string | null;
  end_date: string | null;
  slug: string | null;
  brand: string | null;
  location: string | null;
  description: string | null;
  link: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type ProfileEducation = {
  id: string;
  school: string;
  degree: string;
  period: string;
  start_date: string | null;
  end_date: string | null;
  slug: string | null;
  link: string | null;
  sort_order: number;
  is_visible: boolean;
};

export type ProfileSkill = {
  id: string;
  label: string;
  sort_order: number;
  is_visible: boolean;
};

export type ProfileStackItem = {
  id: string;
  label: string;
  slug: string;
  bg: string;
  fg: string;
  icon_url: string | null;
  sort_order: number;
  is_visible: boolean;
};

type ConvexRow = Record<string, unknown> & { _id: string };

function mapRow(row: ConvexRow): Record<string, unknown> {
  const out: Record<string, unknown> = { id: row._id };
  for (const [key, val] of Object.entries(row)) {
    if (key === "_id" || key === "_creationTime" || key === "createdAt" || key === "updatedAt") continue;
    // Convert Convex camelCase keys back to the snake_case shape the
    // public pages and admin form have always consumed.
    const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    out[snake] = val;
  }
  return out;
}

async function safeList<T>(table: "profileExperience" | "profileEducation" | "profileSkills" | "profileStack"): Promise<T[]> {
  try {
    const rows = await convexQuery<ConvexRow[]>(api.profile.listVisible, { table });
    return ((rows ?? []).map(mapRow) as unknown) as T[];
  } catch {
    return [];
  }
}

export function getExperienceServer(): Promise<ProfileExperience[]> {
  return safeList<ProfileExperience>("profileExperience");
}

export function getEducationServer(): Promise<ProfileEducation[]> {
  return safeList<ProfileEducation>("profileEducation");
}

export function getSkillsServer(): Promise<ProfileSkill[]> {
  return safeList<ProfileSkill>("profileSkills");
}

export function getStackServer(): Promise<ProfileStackItem[]> {
  return safeList<ProfileStackItem>("profileStack");
}
