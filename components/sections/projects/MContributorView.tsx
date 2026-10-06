"use client";

import { useEffect, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { Globe, X } from "lucide-react";
import { Github, Linkedin } from "@/components/dashboard/primitives/icons";
import type { ProjectContributor } from "@/data/projects";

/**
 * for-your-project M-ContributorView ported to the public site:
 * contributor pop-up opened from the project detail Team list.
 * Wine tokens, no dashboard coupling.
 */
export function MContributorView({
  contributor,
  onClose,
}: {
  contributor: ProjectContributor;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const links: { label: string; href: string; Icon: ComponentType<{ size?: number; className?: string }> }[] = [];
  if (contributor.github) links.push({ label: "GitHub", href: contributor.github, Icon: Github });
  if (contributor.linkedin) links.push({ label: "LinkedIn", href: contributor.linkedin, Icon: Linkedin });
  if (contributor.portfolio) links.push({ label: "Portfolio", href: contributor.portfolio, Icon: Globe });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${contributor.name} — contributor details`}
      className="animate-fade-in fixed inset-0 z-[130] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="animate-scale-in glass-panel-deep w-full max-w-[400px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b border-border px-6 py-4"
        >
          <h2 className="font-display text-lg font-bold text-text-primary">
            Contributor Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contributor details"
            className="btn-icon"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-5 px-6 py-6">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full border-4"
              style={{ borderColor: "var(--border-strong)", backgroundColor: "var(--accent-soft)" }}
            >
              {contributor.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contributor.image}
                  alt={contributor.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-display text-4xl font-bold text-accent-text">
                  {contributor.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-center">
              <h3 className="font-display text-2xl font-bold text-text-primary">
                {contributor.name}
              </h3>
              <p
                className="mt-2 inline-block rounded-full px-3 py-1 text-base font-semibold text-accent-text"
                style={{ backgroundColor: "var(--accent-soft)" }}
              >
                {contributor.role}
              </p>
            </div>
          </div>

          {links.length > 0 && (
            <div className="w-full text-center">
              <h4 className="mb-3 font-display text-base font-bold text-text-primary">
                Connect
              </h4>
              <div className="flex flex-wrap justify-center gap-3">
                {links.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href.startsWith("http") ? href : `https://${href}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${contributor.name} on ${label}`}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-text-secondary transition-all hover:scale-110 hover:text-white"
                    style={{ backgroundColor: "var(--input-bg)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--accent-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--input-bg)";
                    }}
                  >
                    <Icon size={22} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
