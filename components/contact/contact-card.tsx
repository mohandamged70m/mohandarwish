"use client";

import { ArrowRight, Check, Copy, FileText, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ME } from "@/Data/me";
import { BookButton } from "@/components/booking/BookButton";
import { FadeIn } from "@/components/ui/motion-primitives";

export function ContactCard(): ReactNode {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(ME.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = ME.email;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <section
      id="contact"
      aria-label="Contact"
      className="flex min-h-[60svh] w-full items-center justify-center px-4 py-10 sm:px-6 sm:py-12 lg:min-h-[80dvh] lg:px-8 lg:py-16 supports-[min-height:100dvh]:lg:min-h-[80dvh]"
    >
      <div className="mx-auto w-full max-w-7xl">
        <FadeIn>
          <div className="relative w-full overflow-hidden rounded-[20px] border border-border bg-bg-surface p-1.5 shadow-sm">
            <div className="relative w-full overflow-hidden rounded-[16px]">
              <div
                className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_20%_50%,var(--accent-ring)_0%,transparent_60%)]"
                aria-hidden
              />
              <div className="relative grid gap-8 p-6 sm:gap-10 sm:p-7 md:grid-cols-[1.25fr_0.9fr] md:items-stretch md:gap-6 md:p-6">
                <div className="flex flex-col gap-5">
                  <div className="space-y-3">
                    <h2 className="font-heading font-semibold leading-[0.95] tracking-tight text-text-primary text-[clamp(2rem,4vw+1rem,3.25rem)]">
                      Let&rsquo;s build
                    </h2>
                    <p className="max-w-[36ch] font-body text-[16px] leading-[1.5] tracking-tight text-text-secondary sm:text-[17px]">
                      Frontend-leaning full-stack — Next.js, TypeScript, Node. Based in {ME.location} (GMT+2), working worldwide.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <BookButton label="Book a call" variant="primary" />
                    <button
                      type="button"
                      onClick={copyEmail}
                      aria-label={copied ? "Email copied to clipboard" : `Copy email ${ME.email}`}
                      aria-live="polite"
                      className="focus-ring inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border border-border bg-bg-primary px-5 font-heading text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
                    >
                      {copied ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden /> : <Copy className="h-4 w-4 shrink-0" aria-hidden />}
                      <span className="hidden sm:inline tabular-nums">{ME.email}</span>
                      <span className="sm:hidden">{copied ? "Copied!" : "Copy email"}</span>
                      <span className="sr-only">{ME.email}</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2 font-heading text-sm">
                    <Link
                      href="/projects"
                      className="focus-ring group inline-flex items-center gap-1.5 text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                    >
                      See projects
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                    <span className="text-border-strong" aria-hidden>
                      ·
                    </span>
                    <a
                      href={ME.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring inline-flex items-center gap-1.5 text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      Download CV
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-6 rounded-[12px] border border-border bg-bg-primary p-6 sm:p-8">
                  <div className="flex items-center gap-3">
                    <SocialIcon href={`mailto:${ME.email}`} label={`Email ${ME.email}`} lucideIcon={Mail} />
                    <SocialIcon href={ME.socials.linkedin} label="LinkedIn" imageSrc="/linkedin.svg" />
                    <SocialIcon href={ME.socials.github} label="GitHub" imageSrc="/github.svg" />
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <a
                      href={`mailto:${ME.email}`}
                      className="focus-ring font-heading text-sm font-medium text-accent underline-offset-4 hover:underline"
                    >
                      {ME.email}
                    </a>
                    <p className="font-body text-[13px] tracking-tight text-text-muted">
                      2026 © {ME.name} · Built with Next.js ·{" "}
                      <a
                        href={ME.socials.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-border underline-offset-4 hover:text-accent"
                      >
                        View source
                      </a>
                    </p>
                    <p className="inline-flex items-center gap-1.5 font-body text-[12px] tracking-tight text-text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                      Alexandria · GMT+2
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {copied ? "Email copied" : ""}
        </span>
      </div>
    </section>
  );
}

function SocialIcon({
  href,
  label,
  lucideIcon: LucideIcon,
  imageSrc,
}: {
  href: string;
  label: string;
  lucideIcon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  imageSrc?: string;
}): ReactNode {
  const isExternal = href.startsWith("http");
  const props = isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Link
      href={href}
      aria-label={label}
      className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-bg-surface text-text-secondary transition-colors hover:border-border-strong hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
      {...props}
    >
      {LucideIcon ? (
        <LucideIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      ) : imageSrc ? (
        <Image src={imageSrc} alt="" width={14} height={14} aria-hidden="true" className="h-[14px] w-[14px] object-contain dark:invert" style={{ height: "auto", width: "auto", maxHeight: "14px", maxWidth: "14px" }} />
      ) : null}
    </Link>
  );
}
