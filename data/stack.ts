import type { IconType } from "react-icons";
import {
  SiAngular,
  SiBun,
  SiClerk,
  SiDocker,
  SiExpo,
  SiExpress,
  SiFastapi,
  SiFigma,
  SiFirebase,
  SiFlutter,
  SiGithub,
  SiGooglegemini,
  SiGo,
  SiGraphql,
  SiHtml5,
  SiJavascript,
  SiLangchain,
  SiMongodb,
  SiNestjs,
  SiNextdotjs,
  SiNodedotjs,
  SiPostgresql,
  SiPrisma,
  SiPython,
  SiReact,
  SiRedis,
  SiRust,
  SiSupabase,
  SiTailwindcss,
  SiTypescript,
  SiVercel,
  SiVite,
} from "react-icons/si";
import { LuDatabase, LuDatabaseZap } from "react-icons/lu";

/**
 * Icon registry. The `icon` field on a tool is a key into this object, so a
 * new tool never needs an import added anywhere else. Common tools are
 * pre-registered: if the brand icon you want is already here, adding a tool
 * is literally one line in STACK below. If not, add its (already installed)
 * react-icons export to this object — still only in this file.
 */
export const stackIcons = {
  SiAngular,
  SiBun,
  SiClerk,
  SiDocker,
  SiExpo,
  SiExpress,
  SiFastapi,
  SiFigma,
  SiFirebase,
  SiFlutter,
  SiGithub,
  SiGooglegemini,
  SiGo,
  SiGraphql,
  SiHtml5,
  SiJavascript,
  SiLangchain,
  SiMongodb,
  SiNestjs,
  SiNextdotjs,
  SiNodedotjs,
  SiPostgresql,
  SiPrisma,
  SiPython,
  SiReact,
  SiRedis,
  SiRust,
  SiSupabase,
  SiTailwindcss,
  SiTypescript,
  SiVercel,
  SiVite,
  // No single logo exists for SQL / NoSQL — two distinct Lucide database marks.
  LuDatabase,
  LuDatabaseZap,
} satisfies Record<string, IconType>;

export type StackIconKey = keyof typeof stackIcons;

export type StackItem = {
  id: string;
  name: string;
  category: string;
  icon: StackIconKey;
  featured?: true;
};

/**
 * The one and only place to edit the stack.
 *
 * TO ADD A TOOL — add exactly one line here:
 *   { id: "bun", name: "Bun", category: "Other", icon: "SiBun" },
 *
 * Mark it `featured: true` to have it appear in the big sentence too.
 * A brand-new category needs no other change: it is discovered automatically
 * and appended to the category key under the marquee rows.
 */
export const STACK: readonly StackItem[] = [
  { id: "typescript", name: "TypeScript", category: "Languages", icon: "SiTypescript", featured: true },
  { id: "python", name: "Python", category: "Languages", icon: "SiPython" },
  { id: "reactjs", name: "ReactJS", category: "Frontend", icon: "SiReact" },
  { id: "nextjs", name: "Next.js", category: "Frontend", icon: "SiNextdotjs", featured: true },
  { id: "nestjs", name: "NestJS", category: "Backend", icon: "SiNestjs", featured: true },
  { id: "sql", name: "SQL", category: "Backend", icon: "LuDatabase" },
  { id: "nosql", name: "NoSQL", category: "Backend", icon: "LuDatabaseZap" },
  { id: "vercel", name: "Vercel", category: "Other", icon: "SiVercel", featured: true },
  { id: "aistudio", name: "AI Studio", category: "Other", icon: "SiGooglegemini", featured: true },
];

/**
 * Big sentence template. `{id}` is replaced by an inline pill built from the
 * tool with that id. Edit this one string to change the sentence.
 */
export const SENTENCE_TEMPLATE =
  "I build full-stack apps in {typescript} with {nextjs} and {nestjs}, add AI with {aistudio}, and ship on {vercel}.";
