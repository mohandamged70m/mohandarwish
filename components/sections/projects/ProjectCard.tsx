"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/data/projects";
import { getTechColor, isVideoFile } from "@/lib/project-utils";
import { canMorph, tagMorph, transitionOrUpdate, untagMorph } from "@/lib/view-transitions";

type Props = {
  project: Project;
  featured?: boolean;
  // Grid showcase: card fills its column instead of fixed carousel widths.
  fluid?: boolean;
};

function CardVideo({ src, isActive, label }: { src: string; isActive: boolean; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      onLoadedMetadata={(e) => {
        // Random starting frame so looping previews never look frozen.
        const video = e.currentTarget;
        if (video.duration && Number.isFinite(video.duration)) {
          try {
            video.currentTime = Math.random() * video.duration;
          } catch {
            // non-fatal: starts from 0
          }
        }
      }}
      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
    />
  );
}

function CardImage({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {/* Skeleton shimmer while the image decodes. */}
      <div
        aria-hidden
        className={`absolute inset-0 z-10 overflow-hidden bg-white/5 transition-opacity duration-700 ${
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
        className="object-cover transition-all duration-500 ease-out group-hover:scale-105"
        style={{
          filter: loaded ? "blur(0px)" : "blur(20px)",
          opacity: loaded ? 1 : 0,
        }}
      />
    </>
  );
}

export function ProjectCard({ project, eager }: Props & { eager?: boolean }) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [current, setCurrent] = useState(0);

  const slides = [...(project.images ?? []), ...(project.videos ?? [])];
  const media = slides.length > 0 ? slides : [project.image];
  const tags = (
    project.tagsDetailed?.length
      ? project.tagsDetailed.map((t) => ({ name: t.name, color: t.color ?? getTechColor(t.name) }))
      : (project.stack ?? []).map((name) => ({ name, color: getTechColor(name) }))
  ).slice(0, 8);
  const contributors = project.contributors ?? [];

  // Hover slideshow: step through media every 2s while hovered.
  useEffect(() => {
    if (!isHovered || media.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % media.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [isHovered, media.length]);

  // INP: the old 3s setInterval toggled tags ↔ contributors on EVERY
  // card forever (N timers + AnimatePresence exit/enter each cycle),
  // keeping the main thread warm between real interactions. Now the
  // overlay swaps on hover/focus only — zero ambient React work.
  const showContributors = isHovered && contributors.length > 0;

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setCurrent(0);
      }}
      onFocus={() => setIsHovered(true)}
      onBlur={() => {
        setIsHovered(false);
        setCurrent(0);
      }}
      data-project-card={project.id}
      aria-label={`${project.title} — ${project.category}`}
      className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-border bg-bg-surface/60 shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
    >
      {/* media — fixed height, hover slideshow across images + videos */}
      <div data-morph-img className="relative h-[200px] w-full overflow-hidden">
        <div
          aria-hidden={media.length < 2}
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{
            width: `${media.length * 100}%`,
            transform: `translateX(-${(current * 100) / media.length}%)`,
          }}
        >
          {media.map((src, i) => (
            <div
              key={`${src}-${i}`}
              style={{ width: `${100 / media.length}%` }}
              className="relative h-full overflow-hidden"
            >
              {isVideoFile(src) ? (
                <CardVideo src={src} isActive={isHovered && current === i} label={`${project.title} preview`} />
              ) : (
                <CardImage src={src} alt={i === 0 ? project.title : ""} eager={eager && i === 0} />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
            </div>
          ))}
        </div>

        {/* top-left overlay: tags, contributors on hover/focus */}
        <div className="absolute left-4 top-4 z-10">
          {!showContributors ? (
            <ul
              className="flex flex-wrap gap-1.5"
              aria-label={`Built with ${tags.map((t) => t.name).join(", ")}`}
            >
                {tags.slice(0, 2).map((tag) => (
                  <li
                    key={tag.name}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-bg-primary/70 px-2.5 py-1 font-heading text-xs font-semibold text-text-secondary shadow-sm backdrop-blur-md"
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: tag.color }}
                    />
                    {tag.name}
                  </li>
                ))}
                {tags.length > 2 && (
                  <li className="rounded-full border border-border bg-bg-primary/70 px-2.5 py-1 font-heading text-xs font-semibold text-text-muted shadow-sm backdrop-blur-md">
                    +{tags.length - 2} more
                  </li>
                )}
              </ul>
            ) : (
              <div
                className="flex items-center"
              >
                <ul className="flex pl-2" aria-label={`${contributors.length} contributors`}>
                  {contributors.slice(0, 3).map((c) => (
                    <li
                      key={c.name}
                      title={c.name}
                      className="-ml-2 h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-bg-surface shadow-sm"
                    >
                      {c.image ? (
                        <Image src={c.image} alt={c.name} width={32} height={32} loading="lazy" unoptimized className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-bg-surface text-[10px] font-bold text-text-muted">
                          {c.name ? c.name.charAt(0) : "?"}
                        </span>
                      )}
                    </li>
                  ))}
                  {contributors.length > 3 && (
                    <li
                      aria-label={`${contributors.length - 3} more contributors`}
                      className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-accent text-[0.7rem] font-bold text-text-on-accent shadow-sm"
                    >
                      +{contributors.length - 3}
                    </li>
                  )}
                </ul>
              </div>
            )}
        </div>
      </div>

      {/* body — title + 3-line description */}
      <div className="flex flex-1 flex-col gap-2.5 p-6">
        <h3 className="line-clamp-1 font-heading text-base font-semibold leading-tight text-text-primary">
          {project.title}
        </h3>
        {project.description && (
          <p className="line-clamp-3 font-body text-sm leading-relaxed text-text-secondary">
            {project.description}
          </p>
        )}
      </div>
    </Link>
  );
}
