"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/data/projects";
import { canMorph, tagMorph, transitionOrUpdate, untagMorph } from "@/lib/view-transitions";

type Props = {
  project: Project;
  featured?: boolean;
  // Grid showcase: card fills its column instead of fixed carousel widths.
  fluid?: boolean;
};

export function ProjectCard({ project, featured = false, fluid = false }: Props) {
  const router = useRouter();

  // Shared-element open: tag this card's media as the morph source, then
  // navigate inside a view transition so it morphs into the modal hero.
  // Falls back to plain Link navigation (modifier-clicks, touch without VT,
  // reduced motion, unsupported browsers).
  const handleOpen = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    // Record the background scroll BEFORE any navigation (morph or plain):
    // the open navigation can clamp it (shorter detail viewport) and history
    // restoration can drop it — modal close restores from this value.
    try {
      sessionStorage.setItem("project-modal-y", String(window.scrollY));
    } catch {
      // non-fatal: close falls back to mount-time capture
    }
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!canMorph()) return;
    const img = e.currentTarget.querySelector<HTMLElement>("[data-morph-img]");
    if (!img) return;
    e.preventDefault();
    tagMorph(img);
    void transitionOrUpdate(() => {
      // scroll:false: the background page must stay exactly where it was
      // (projects section) — a scroll-to-top here strands modal close on
      // the hero even with history back.
      router.push(project.href, { scroll: false });
    }).finally(() => {
      untagMorph(img);
    });
  };

  return (
    <Link
      href={project.href}
      scroll={false}
      onClick={handleOpen}
      data-project-card={project.id}
      aria-label={`${project.title} — ${project.category}`}
      className={`group relative flex min-w-0 shrink-0 flex-col bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
        fluid
          ? "w-full min-w-0"
          : "w-[min(82vw,360px)] sm:w-[420px] md:w-[440px] lg:w-[520px] xl:w-[560px]"
      }`}
    >
      {/* frameless media - no border, no chrome, just image */}
      <div data-morph-img className="relative aspect-[16/10] w-full overflow-hidden rounded-sm bg-bg-primary">
        <Image
          src={project.image}
          alt={project.title}
          fill
          sizes={
            fluid
              ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              : "(max-width: 640px) 82vw, (max-width: 768px) 420px, (max-width: 1024px) 440px, (max-width: 1440px) 520px, 560px"
          }
          className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[0.22,1,0.36,1] motion-safe:group-hover:scale-[1.04] motion-safe:group-focus-visible:scale-[1.04]"
        />
        {/* soft vignette only - no frame */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />

        {/* minimal top badge */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Badge
            variant="default"
            className="bg-bg-surface/85 backdrop-blur-md border-0 text-[11px] px-2.5 py-1 shadow-none"
          >
            {project.category}
          </Badge>
          {featured && (
            <Badge variant="accent" className="hidden sm:inline-flex text-[10px] px-2 py-1 border-0">
              Featured
            </Badge>
          )}
        </div>

        {/* persistent open hint — always visible, never hover-only (touch + keyboard) */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 motion-safe:transition-all motion-safe:duration-300 motion-safe:group-hover:translate-y-0 motion-safe:group-focus-visible:translate-y-0">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-bg-surface/95 backdrop-blur-md px-3 py-1.5 font-heading text-xs text-text-primary shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
            View case study <ArrowUpRight className="h-3.5 w-3.5 text-accent-text" aria-hidden="true" />
          </span>
        </div>
      </div>

      {/* editorial footer - transparent, no box */}
      <div className="flex flex-col gap-1.5 px-1 pt-4 pb-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display font-semibold text-[18px] leading-tight text-text-primary group-hover:text-accent-text transition-colors line-clamp-1">
            {project.title}
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1 font-heading text-[11px] uppercase tracking-wide text-text-muted group-hover:text-accent-text transition-colors" aria-hidden="true">
            {project.year ?? ""} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
        {project.description && (
          <p className="font-body text-[13px] leading-relaxed text-text-secondary line-clamp-2">
            {project.description}
          </p>
        )}
        {(project.stack?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {project.stack!.slice(0, 3).map((s) => (
              <Badge key={s} variant="soft" className="text-[11px] leading-none">
                {s}
              </Badge>
            ))}
            {project.stack!.length > 3 && (
              <Badge variant="default" className="text-[11px] leading-none" aria-label={`${project.stack!.length - 3} more technologies`}>
                +{project.stack!.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
