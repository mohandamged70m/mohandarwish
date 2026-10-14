"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { Project } from "@/data/projects";
import { getTechColor, isVideoFile } from "@/lib/project-utils";
import { canMorph, tagMorph, transitionOrUpdate, untagMorph } from "@/lib/view-transitions";

type Props = {
  project: Project;
  eager?: boolean;
  /** Shared swap state from useTechSwap() in the parent grid. Never own a timer. */
  showTech?: boolean;
  /** Defaults to the cutout in /public. */
  avatarSrc?: string;
};

const DEFAULT_AVATAR = "/me/mohand-cutout.png";

function CardImage({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {/* Skeleton shimmer while the image decodes. */}
      <div
        aria-hidden
        className={`absolute inset-0 z-[1] overflow-hidden bg-white/5 transition-opacity duration-700 motion-reduce:transition-none ${
          loaded ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {!loaded && (
          <div className="absolute inset-0 motion-safe:animate-[shimmer-fast_1.2s_infinite_ease-in-out] motion-safe:bg-gradient-to-r motion-safe:from-transparent motion-safe:via-white/20 motion-safe:to-transparent" />
        )}
      </div>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        loading={eager ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        style={{
          transformOrigin: "top center",
          filter: loaded ? "blur(0px)" : "blur(20px)",
          opacity: loaded ? 1 : 0,
        }}
      />
    </>
  );
}

/**
 * Project card (v2) — rounded 28px surface, 16:9 screenshot with a
 * top-left swapping badge (photo <-> tech chips), title + 3-line
 * description. The whole card opens the project details modal.
 */
export function ProjectCard({ project, eager, showTech = false, avatarSrc = DEFAULT_AVATAR }: Props) {
  const router = useRouter();
  const cardRef = useRef<HTMLElement>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  // Hover hold: freeze this card on its badge state while hovered, catch up on leave.
  const [held, setHeld] = useState<boolean | null>(null);
  const effective = held ?? showTech;

  const techNames =
    project.tagsDetailed?.length
      ? project.tagsDetailed.map((t) => t.name)
      : [...(project.stack ?? [])];
  const visible = techNames.slice(0, 2);
  const remaining = techNames.length - visible.length;

  const open = useCallback(() => {
    try {
      sessionStorage.setItem("project-modal-y", String(window.scrollY));
    } catch {
      // non-fatal: close falls back to mount-time capture
    }
    const img = cardRef.current?.querySelector<HTMLElement>("[data-morph-img]");
    if (!img || !canMorph()) {
      router.push(project.href, { scroll: false });
      return;
    }
    tagMorph(img);
    void transitionOrUpdate(() => {
      // scroll:false keeps the background page where it was (projects section).
      router.push(project.href, { scroll: false });
    }).finally(() => {
      untagMorph(img);
    });
  }, [project.href, router]);

  const heroSrc = project.image;

  return (
    <article
      ref={cardRef}
      tabIndex={0}
      role="button"
      aria-label={`Open ${project.title} details`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onPointerEnter={() => setHeld(showTech)}
      onPointerLeave={() => setHeld(null)}
      data-project-card={project.id}
      className="group relative flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-[28px] border border-border bg-bg-surface font-body outline-none transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-[5px] hover:border-accent hover:shadow-[0_18px_40px_-18px_color-mix(in_srgb,var(--accent-primary)_45%,transparent)] focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* screenshot — 16:9 */}
      <div data-morph-img className="relative aspect-video w-full overflow-hidden">
        {isVideoFile(heroSrc) ? (
          <video
            src={heroSrc}
            muted
            loop
            playsInline
            autoPlay
            aria-label={`${project.title} preview`}
            className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
            style={{ transformOrigin: "top center" }}
          />
        ) : (
          <CardImage src={heroSrc} alt={project.title} eager={eager} />
        )}
        {/* top gradient so the badge stays readable */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,rgba(0,0,0,0.35),transparent_45%)]"
        />

        {/* swapping badge: photo <-> tech chips */}
        <div className="absolute left-[14px] top-[14px] z-[3] h-11 min-w-11">
          {/* photo */}
          <div
            aria-hidden={effective}
            style={effective ? { transform: "scale(0.2) rotate(-120deg)", opacity: 0 } : undefined}
            className="absolute left-0 top-0 h-11 w-11 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-[1.12] group-hover:-rotate-4 motion-reduce:transition-none"
          >
            {avatarFailed ? (
              <span className="absolute inset-0 z-[1] flex items-center justify-center rounded-full bg-accent text-sm font-bold text-text-on-accent shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
                MD
              </span>
            ) : (
              <Image
                src={avatarSrc}
                alt="Mohand Darwish"
                width={44}
                height={44}
                loading="lazy"
                onError={() => setAvatarFailed(true)}
                className="absolute inset-0 z-[1] h-full w-full rounded-full bg-bg-surface-hover object-cover object-[50%_15%] shadow-[0_4px_14px_rgba(0,0,0,0.45)]"
              />
            )}
            <span
              aria-hidden
              className="absolute -bottom-[1px] -right-[1px] z-[2] h-3 w-3 rounded-full border-2 border-bg-surface bg-green-400"
            />
          </div>

          {/* tech chips */}
          <div
            aria-hidden={!effective}
            aria-label={techNames.length ? `Built with ${techNames.join(", ")}` : undefined}
            className="pointer-events-none absolute left-0 top-0 flex h-11 items-center gap-1.5 whitespace-nowrap"
          >
            {visible.map((name, i) => (
              <span
                key={name}
                style={{
                  opacity: effective ? 1 : 0,
                  transform: effective ? "none" : "translateX(-14px) scale(0.85)",
                  transitionDelay: effective ? `${150 + i * 70}ms` : "0ms",
                }}
                className="rounded-full border border-white/10 bg-bg-primary/70 px-3 py-2 text-[12.5px] font-semibold leading-none text-text-primary shadow-sm backdrop-blur-[10px] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
              >
                <span
                  aria-hidden
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ background: getTechColor(name) }}
                />
                {name}
              </span>
            ))}
            {remaining > 0 && (
              <span
                style={{
                  opacity: effective ? 1 : 0,
                  transform: effective ? "none" : "translateX(-14px) scale(0.85)",
                  transitionDelay: effective ? `${150 + visible.length * 70}ms` : "0ms",
                }}
                className="rounded-full border border-transparent bg-accent px-3 py-2 text-[12.5px] font-semibold leading-none text-text-on-accent shadow-sm backdrop-blur-[10px] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
              >
                +{remaining} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* body — title + 3-line description, no chips */}
      <div className="flex flex-1 flex-col gap-2 px-6 pb-[26px] pt-[22px]">
        <h3 className="font-body text-2xl font-bold leading-[1.2] tracking-tight text-text-primary">
          {project.title}
        </h3>
        {project.description && (
          <p className="line-clamp-3 font-body text-base leading-relaxed text-text-secondary">
            {project.description}
          </p>
        )}
      </div>
    </article>
  );
}
