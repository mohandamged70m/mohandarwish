import Image from "next/image";
import { ArrowUpRight, Code, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/Data/projects";

const isRealUrl = (url?: string) => Boolean(url) && url !== "#";

type Props = {
  project: Project;
};

export function ProjectDetailContent({ project }: Props) {
  const hero = (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-bg-primary">
      <Image
        src={project.image}
        alt={project.title}
        fill
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
        priority
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent opacity-70" />
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <Badge
          variant="default"
          className="bg-bg-surface/90 backdrop-blur border-border text-[11px] px-2.5 py-1 shadow-sm"
        >
          {project.category}
        </Badge>
        {project.year && (
          <Badge variant="soft" className="text-[11px] px-2.5 py-1 shadow-sm">
            {project.year}
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      {hero}

      <div className="flex flex-col gap-5 px-5 pt-5 pb-6 sm:px-7 sm:pb-7">
        <h2 className="font-heading font-semibold text-xl leading-tight tracking-tight text-text-primary">
          {project.title}
        </h2>

        {project.problem && (
          <div className="rounded-[12px] border border-accent/20 bg-accent/5 px-4 py-3">
            <p className="font-heading text-xs uppercase tracking-wide text-accent mb-1">Problem</p>
            <p className="font-body text-[14px] leading-relaxed text-text-secondary">{project.problem}</p>
          </div>
        )}

        {project.description && (
          <p className="font-body text-[15px] leading-relaxed text-text-secondary">
            {project.description}
          </p>
        )}

        {project.role && (
          <p className="font-heading text-sm text-text-muted"><span className="text-text-primary font-medium">Role:</span> {project.role}</p>
        )}

        {project.metrics && project.metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {project.metrics.map((m) => (
              <div key={m.label} className="rounded-[12px] border border-border bg-bg-primary px-3 py-3">
                <p className="font-heading text-[11px] uppercase tracking-wide text-text-muted">{m.label}</p>
                <p className="font-heading text-[15px] font-semibold text-text-primary">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {project.highlights && project.highlights.length > 0 && (
          <ul className="flex flex-col gap-2">
            {project.highlights.map((h) => (
              <li key={h} className="flex gap-2 font-body text-sm text-text-secondary">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        )}

        {project.stack && project.stack.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.stack.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center rounded-pill border border-border bg-bg-primary px-3 py-1.5 font-body text-xs leading-none text-text-secondary"
              >
                {tech}
              </span>
            ))}
          </div>
        )}

        {(isRealUrl(project.liveUrl) || isRealUrl(project.githubUrl)) && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isRealUrl(project.liveUrl) && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-pill bg-accent px-4 py-2 font-heading text-sm text-text-on-accent shadow-[0_0_20px_var(--accent-ring)] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] focus-ring outline-none"
              >
                Live demo
                <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
            {isRealUrl(project.githubUrl) && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-pill border border-border bg-bg-primary px-4 py-2 font-heading text-sm text-text-primary transition-colors duration-300 hover:border-accent/40 hover:text-accent focus-ring outline-none"
              >
                <Code className="h-4 w-4" />
                Source code
              </a>
            )}
          </div>
        )}

        {!isRealUrl(project.liveUrl) && !isRealUrl(project.githubUrl) && (
          <div className="flex flex-wrap items-center gap-3 pt-1 text-text-muted">
            <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-bg-primary px-4 py-2 font-heading text-sm opacity-60">
              <ExternalLink className="h-4 w-4" />
              Links coming soon
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
