"use client";

import { useEffect, useState } from "react";
import type { EducationEntry } from "@/components/about/education";
import type { ExperienceEntry } from "@/components/about/experience";
import type { StackChip } from "@/components/about/stack";

type ExperienceRow = {
  company: string;
  role: string;
  period: string;
  slug: string | null;
  brand: string | null;
};

type EducationRow = {
  school: string;
  degree: string;
  period: string;
  slug: string | null;
};

type SkillRow = { label: string };
type StackRow = {
  label: string;
  slug: string;
  bg: string;
  fg: string;
  icon_url: string | null;
};

async function fetchItems<T>(section: string): Promise<T[]> {
  const res = await fetch(`/api/profile/${section}`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => ({}))) as { items?: T[] };
  return json.items ?? [];
}

export function useProfile() {
  const [experience, setExperience] = useState<ExperienceEntry[] | undefined>(undefined);
  const [education, setEducation] = useState<EducationEntry[] | undefined>(undefined);
  const [skills, setSkills] = useState<string[] | undefined>(undefined);
  const [stack, setStack] = useState<StackChip[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [exp, edu, skl, stk] = await Promise.all([
        fetchItems<ExperienceRow>("experience"),
        fetchItems<EducationRow>("education"),
        fetchItems<SkillRow>("skills"),
        fetchItems<StackRow>("stack"),
      ]);
      if (cancelled) return;
      if (exp.length > 0)
        setExperience(exp.map((e) => ({ company: e.company, role: e.role, period: e.period, slug: e.slug, brand: e.brand })));
      else setExperience([]);
      if (edu.length > 0)
        setEducation(edu.map((e) => ({ school: e.school, degree: e.degree, period: e.period, slug: e.slug })));
      else setEducation([]);
      if (skl.length > 0) setSkills(skl.map((s) => s.label).filter(Boolean));
      else setSkills([]);
      if (stk.length > 0)
        setStack(stk.map((c) => ({ label: c.label, slug: c.slug, bg: c.bg, fg: c.fg, iconUrl: c.icon_url })));
      else setStack([]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { experience, education, skills, stack };
}
