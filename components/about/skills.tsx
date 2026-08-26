import type { ReactNode } from "react";

const SKILLS = [
  "React / Next.js",
  "TypeScript",
  "Tailwind / Storybook",
  "Node / tRPC / Prisma",
  "Performance & Web Vitals",
  "Accessibility (a11y)",
  "Testing (Playwright / Vitest)",
  "System Design",
  "Design Systems",
];

export function Skills(): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-[15px] font-semibold tracking-tight text-text-primary">
        What I do — Frontend-leaning Full-Stack
      </h3>
      <div className="rounded-[20px] border border-border bg-bg-surface p-2 sm:p-4">
        <div className="flex flex-wrap gap-2.5">
          {SKILLS.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-border bg-bg-primary px-3.5 py-2 font-body text-[13px] leading-none tracking-tight text-text-secondary sm:text-[14px]"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
