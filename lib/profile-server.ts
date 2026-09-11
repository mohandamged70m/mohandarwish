import { supabaseServer } from "@/lib/supabase/server";

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

async function safeList<T>(table: string): Promise<T[]> {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

export function getExperienceServer(): Promise<ProfileExperience[]> {
  return safeList<ProfileExperience>("profile_experience");
}

export function getEducationServer(): Promise<ProfileEducation[]> {
  return safeList<ProfileEducation>("profile_education");
}

export function getSkillsServer(): Promise<ProfileSkill[]> {
  return safeList<ProfileSkill>("profile_skills");
}

export function getStackServer(): Promise<ProfileStackItem[]> {
  return safeList<ProfileStackItem>("profile_stack");
}
