import type { ReactNode } from "react";

type Entry = {
  school: string;
  degree: string;
  period: string;
  slug?: string;
};

const ENTRIES: Entry[] = [
  {
    school: "Alexandria University",
    degree: "B.Sc. Computer Engineering — Frontend & Systems focus",
    period: "2019 – 2023",
  },
  {
    school: "ALX / Holberton",
    degree: "Advanced Frontend & Backend (React, Node)",
    period: "2022 – 2023",
  },
  {
    school: "Continuous Learning",
    degree: "Web Performance, A11y & Design Systems",
    period: "2023 – Present",
  },
];

const ROW_HEIGHT = 64;

export function Education(): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-[15px] font-semibold tracking-tight text-text-primary">
        Education
      </h3>
      <div className="border-border bg-bg-surface relative rounded-[20px] border p-2 sm:p-4">
        <ul className="flex flex-col gap-2">
          {ENTRIES.map((entry) => (
            <li
              key={`${entry.school}-${entry.period}`}
              className="bg-bg-primary border-border flex items-center gap-4 rounded-[16px] border p-2"
              style={{ minHeight: ROW_HEIGHT }}
            >
              <SchoolLogo entry={entry} />
              <div className="flex min-w-0 flex-col">
                <span className="text-text-primary text-[17px] font-semibold tracking-tight sm:text-[18px]">
                  {entry.school}
                </span>
                <span className="text-text-secondary mt-0.5 text-[14px] tracking-tight sm:text-[15px]">
                  {entry.degree}
                  <span className="text-text-muted mx-2">•</span>
                  <span className="text-text-muted">{entry.period}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SchoolLogo({ entry }: { entry: Entry }): ReactNode {
  const initials = entry.school.charAt(0);
  return (
    <span
      className="border-border inline-flex h-12 w-12 shrink-0 items-center justify-center border bg-bg-primary"
      aria-hidden="true"
      style={{ borderRadius: 14 }}
    >
      {entry.slug ? (
        <img
          src={`https://cdn.simpleicons.org/${entry.slug}`}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6"
          draggable={false}
        />
      ) : (
        <span className="text-text-muted text-[18px] font-semibold tracking-tight">
          {initials}
        </span>
      )}
    </span>
  );
}
