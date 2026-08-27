import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/Data/projects";

type Props = {
  project: Project;
  featured?: boolean;
};

export function ProjectCard({ project, featured = false }: Props) {
  return (
    <Link
      href={project.href}
      aria-label={`${project.title} — ${project.category}`}
      className={`group relative flex min-w-0 shrink-0 flex-col overflow-hidden bg-bg-surface border transition-[transform,box-shadow,border-color,background-color] duration-300 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary
        hover:bg-bg-surface-hover hover:border-border-strong hover:-translate-y-1.5
        ${featured ? "rounded-[20px] lg:rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.45)] lg:shadow-[0_18px_56px_rgba(0,0,0,0.55)] hover:shadow-[0_20px_56px_rgba(0,0,0,0.6)]" : "rounded-[18px] shadow-[0_6px_24px_rgba(0,0,0,0.25)] hover:shadow-[0_16px_40px_rgba(0,0,0,0.38)]"}
        ${featured ? "w-[min(88vw,360px)] sm:w-[min(52vw,480px)] lg:w-[560px]" : "w-[min(88vw,360px)] sm:w-[min(46vw,420px)] lg:w-[500px] opacity-[0.97] hover:opacity-100"}`}
    >
      {/* accent top line on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {/* inner frame */}
      <div
        className={`relative overflow-hidden bg-bg-primary border border-border/60
          ${featured ? "rounded-[14px] mx-2 mt-2" : "rounded-[12px] mx-2 mt-2"}`}
      >
        {/* browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border/40 bg-bg-surface/40">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] border border-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] border border-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] border border-black/10" />
          <span className="ml-3 hidden sm:inline-flex h-5 flex-1 max-w-[220px] items-center gap-2 rounded-full bg-bg-primary border border-border px-2.5 font-body text-[11px] text-text-muted truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            {project.title}
          </span>
          {featured && (
            <span className="ml-auto hidden lg:inline-flex items-center gap-1.5">
              {project.stack?.slice(0, 2).map((s) => (
                <span
                  key={s}
                  className="rounded-pill bg-bg-primary border border-border px-2 py-0.5 font-heading text-[10px] leading-none text-text-secondary"
                >
                  {s}
                </span>
              ))}
            </span>
          )}
        </div>

        <div className="relative aspect-[16/10] w-full overflow-hidden bg-bg-primary">
          <Image
            src={project.image}
            alt={project.title}
            fill
            sizes={featured ? "(max-width: 640px) 88vw, (max-width: 1024px) 52vw, 560px" : "(max-width: 640px) 88vw, (max-width: 1024px) 46vw, 500px"}
            className="object-cover will-change-transform transition-transform duration-700 ease-[0.22,1,0.36,1] group-hover:scale-[1.06] group-focus-visible:scale-[1.06]"
            priority={featured}
          />
          {/* gradient */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent opacity-70" />

          {/* top badges */}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Badge variant="default" className="bg-bg-surface/90 backdrop-blur border-border text-[11px] px-2.5 py-1 shadow-sm">
              {project.category}
            </Badge>
            {project.year && (
              <Badge variant="soft" className="text-[11px] px-2.5 py-1 shadow-sm">
                {project.year}
              </Badge>
            )}
            {featured && (
              <Badge variant="accent" className="hidden sm:inline-flex text-[10px] px-2 py-1">
                Featured
              </Badge>
            )}
          </div>

          {/* hover overlay + CTA */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-primary/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-bg-surface border border-border px-3 py-1.5 font-heading text-xs text-text-primary shadow-md">
              View case study <ArrowUpRight className="h-3.5 w-3.5 text-accent" />
            </span>
            <span className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-text-on-accent shadow-[0_0_20px_var(--accent-ring)]">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      {/* footer editorial */}
      <div className="flex flex-col gap-2 px-3 pt-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading font-semibold text-[15px] leading-tight text-text-primary group-hover:text-accent transition-colors line-clamp-1">
            {project.title}
          </h3>
          <span className="hidden sm:inline-flex shrink-0 items-center gap-1 font-heading text-[11px] uppercase tracking-wide text-text-muted group-hover:text-accent transition-colors">
            View <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
        {project.description && (
          <p className="font-body text-[13px] leading-relaxed text-text-secondary line-clamp-2">
            {project.description}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {project.stack?.slice(0, 2).map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-pill border border-border bg-bg-primary px-2 py-1 font-body text-[11px] leading-none text-text-secondary"
              >
                {s}
              </span>
            ))}
            {project.year && (
              <span className="inline-flex items-center rounded-pill border border-border bg-accent-soft px-2 py-1 font-heading text-[11px] leading-none text-accent-soft-text">
                {project.year}
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            {project.githubUrl && project.githubUrl !== "#" && (
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-primary font-heading text-[10px] leading-none text-text-muted group-hover:border-accent/30 group-hover:text-accent transition-colors"
              >
                GH
              </span>
            )}
            {project.liveUrl && project.liveUrl !== "#" && (
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-primary text-text-muted group-hover:border-accent/30 group-hover:text-accent transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
