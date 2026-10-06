"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Project } from "@/data/projects";
import { ProjectCard } from "./ProjectCard";
import { GlassChip } from "@/components/ui/glassy-button";
import { useProjects } from "@/hooks/useProjects";
import { useTailor } from "@/lib/analytics/tailor";
import { getTechColor } from "@/lib/project-utils";
import { sanitizeSvg } from "@/lib/sanitize";

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i]![j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1]![j - 1]!
          : Math.min(matrix[i - 1]![j - 1]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j]! + 1);
    }
  }
  return matrix[b.length]![a.length]!;
}

type TagInfo = {
  name: string;
  color: string;
  iconSvg?: string;
};

/**
 * for-your-project grid (Projects.tsx) ported to this repo:
 * searchable + tag-filterable slideshow cards over the live Convex
 * projects (useProjects), share-link pins first, then listing order.
 * Projects-only — no Developer tab.
 */
export function ProjectsGrid({ initialProjects }: { initialProjects?: Project[] }) {
  const { projects, loading } = useProjects(initialProjects);
  const tailor = useTailor();
  const reduce = useReducedMotion();
  const noMotion = reduce ? { initial: false as const } : {};

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Search only earns its place once there's enough to search through.
  const showSearch = projects.length >= 6;

  // Debounce search input — filter 250ms after the user stops typing.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Clear a stale query when the list shrinks below the search threshold.
  useEffect(() => {
    if (projects.length < 6) {
      setSearchQuery("");
      setDebouncedSearch("");
    }
  }, [projects.length]);

  // Every tag used across projects, with dashboard color/icon when known.
  const availableTags = useMemo<TagInfo[]>(() => {
    const seen = new Map<string, TagInfo>();
    for (const p of projects) {
      for (const t of p.tagsDetailed ?? []) {
        const key = t.name.toLowerCase();
        const prev = seen.get(key);
        if (!prev || (!prev.iconSvg && t.iconSvg)) {
          seen.set(key, { name: t.name, color: t.color ?? getTechColor(t.name), iconSvg: t.iconSvg });
        }
      }
      for (const name of p.stack ?? []) {
        const key = name.toLowerCase();
        if (!seen.has(key)) seen.set(key, { name, color: getTechColor(name) });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filtered = useMemo(() => {
    let results = [...projects];

    if (selectedTags.length > 0) {
      const wanted = selectedTags.map((t) => t.toLowerCase());
      results = results.filter((p) => {
        const haystack = [
          ...(p.tagsDetailed ?? []).map((t) => t.name.toLowerCase()),
          ...(p.stack ?? []).map((s) => s.toLowerCase()),
        ];
        return wanted.every((tag) => haystack.includes(tag));
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query.length >= 2) {
      const matches = (term: string) => {
        const lower = term.toLowerCase();
        if (!lower) return false;
        if (lower.includes(query)) return true;
        return lower
          .split(/[\s\-_]+/)
          .some((word) => word.length >= 3 && levenshtein(query, word) <= 2);
      };
      results = results.filter(
        (p) =>
          matches(p.title) ||
          matches(p.description ?? "") ||
          (p.stack ?? []).some(matches) ||
          (p.tagsDetailed ?? []).some((t) => matches(t.name)) ||
          (p.contributors ?? []).some((c) => matches(c.name)),
      );
    } else {
      // Default order: share-link pins first, then the owner's listing order.
      const pinned = tailor?.Pinned ?? [];
      const rank = (id: string) => {
        const at = pinned.indexOf(id);
        return at === -1 ? Infinity : at;
      };
      results.sort((a, b) => {
        const pinDelta = rank(a.id) - rank(b.id);
        if (pinDelta !== 0) return pinDelta;
        const al = a.listing && a.listing > 0 ? a.listing : 999999;
        const bl = b.listing && b.listing > 0 ? b.listing : 999999;
        if (al !== bl) return al - bl;
        return a.title.localeCompare(b.title);
      });
    }

    return results;
  }, [projects, selectedTags, debouncedSearch, tailor]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-8">
      <p className="sr-only" aria-live="polite">
        Showing {filtered.length} projects
      </p>

      {/* Search — only when there are at least 6 projects to search through */}
      {showSearch && (
        <div className="w-full max-w-[600px]">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-surface px-4 py-3 shadow-sm">
            <Search size={20} className="shrink-0 text-text-muted" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by title, tags, or contributor..."
              aria-label="Search projects"
              className="w-full border-none bg-transparent font-body text-base text-text-primary outline-none placeholder:text-text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-text-muted transition-colors hover:bg-bg-surface-hover hover:text-text-primary"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tag filter — for-your-project "Filter View" row */}
      {availableTags.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="mr-2 text-xs font-bold uppercase tracking-widest text-text-muted opacity-60">
            Filter view:
          </span>
          {availableTags.map((tag) => {
            const isActive = selectedTags.includes(tag.name);
            const icon = (tag.iconSvg ?? "").trim();
            const isUrl = /^(https?:|data:image)/.test(icon);
            return (
              <GlassChip
                key={tag.name}
                type="button"
                onClick={() => toggleTag(tag.name)}
                aria-pressed={isActive}
                active={isActive}
              >
                {icon ? (
                  isUrl ? (
                    <Image src={icon} alt="" aria-hidden="true" width={16} height={16} loading="lazy" draggable={false} unoptimized className="h-4 w-4 shrink-0 object-contain" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
                      dangerouslySetInnerHTML={{ __html: sanitizeSvg(icon) }}
                    />
                  )
                ) : (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: tag.color }}
                  />
                )}
                {tag.name}
              </GlassChip>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="ml-1 cursor-pointer border-none bg-transparent px-3 py-2 font-heading text-xs font-bold uppercase tracking-widest text-accent-text transition-opacity hover:opacity-70"
            >
              [ Reset ]
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="w-full rounded-[16px] border border-border bg-bg-surface px-6 py-10 text-center">
          <p className="font-heading text-sm font-medium text-text-primary">Loading projects…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="w-full rounded-[16px] border border-dashed border-border bg-bg-surface px-6 py-10 text-center">
          <p className="font-heading text-sm font-medium text-text-primary">
            {projects.length === 0
              ? "No projects yet — add one from the dashboard"
              : "No projects match — try a different search or reset the filters"}
          </p>
          <p className="mt-1 font-body text-sm text-text-muted">
            {projects.length === 0
              ? "Dashboard → Projects → Add Project, it appears here live."
              : "Clear the search or reset the filters to see projects."}
          </p>
        </div>
      ) : (
        <div
          role="list"
          aria-label="Projects"
          className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-6"
        >
          {filtered.map((project, i) => (
            <motion.div
              key={project.id}
              role="listitem"
              className="min-w-0"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: reduce ? 0.01 : 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: reduce ? 0 : (i % 3) * 0.08,
              }}
              {...noMotion}
            >
              <ProjectCard project={project} eager={i < 2} />
            </motion.div>
          ))}
        </div>
      )}

      <span className="font-heading text-[11px] uppercase tracking-[0.14em] text-text-muted">
        {filtered.length} {filtered.length === 1 ? "project" : "projects"}
      </span>
    </div>
  );
}
