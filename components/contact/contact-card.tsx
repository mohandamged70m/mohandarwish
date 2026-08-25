"use client";

import { Check, Code2, Copy, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ContactForm } from "./contact-form";
import { CONTACT, ME } from "@/Data/me";

export function ContactCard(): ReactNode {
  const year = new Date().getFullYear();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = CONTACT.email;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <section
      id="contact"
      aria-label="Contact"
      className="relative w-full overflow-hidden border-t border-border/50 bg-bg-primary"
    >
      {/* backdrop — very subtle, matches hero/projects grammar */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-y-0 right-0 w-[72%] bg-[radial-gradient(ellipse_at_78%_46%,var(--accent-ring)_0%,transparent_62%)] opacity-50" />
        <div className="absolute inset-0 opacity-[0.02] [mask-image:radial-gradient(ellipse_at_78%_40%,black_40%,transparent_75%)] bg-[linear-gradient(to_right,var(--border-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-strong)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-18 lg:py-24">
        {/* section header — eyebrow centered on mobile, left on desktop via grid */}
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.02fr_0.92fr] lg:gap-12 xl:gap-16 items-start">
            {/* LEFT — narrative + direct actions */}
            <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:pr-2">
              <div className="inline-flex">
                <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-bg-surface px-3 py-1.5 font-heading text-[11px] font-medium uppercase tracking-widest text-text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                  Get in touch
                </span>
              </div>

              <div className="space-y-4">
                <h2 className="font-heading text-[2.15rem] font-bold leading-[0.92] tracking-[-0.02em] text-text-primary sm:text-[2.6rem] lg:text-[3.1rem]">
                  Let&apos;s build
                  <br />
                  <span className="text-text-primary">something great.</span>
                </h2>
                <div
                  aria-hidden
                  className="h-px w-16 bg-gradient-to-r from-accent/60 to-transparent"
                />
                <p className="max-w-[44ch] font-body text-[15px] leading-relaxed text-text-secondary sm:text-base">
                  Have an idea, project, or just want to say hi? I&apos;m
                  available for new opportunities and would love to hear from
                  you.
                </p>
              </div>

              {/* direct email card — primary easy action */}
              <div className="flex flex-col gap-3">
                <div className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg-surface px-4 py-3.5 sm:px-5 sm:py-4 transition-colors hover:border-border-strong">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-text-on-accent">
                      <Mail className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col text-left">
                      <span className="font-heading text-xs font-medium tracking-wide text-text-muted">
                        Email me directly
                      </span>
                      <span className="truncate font-heading text-sm font-medium tracking-tight text-text-primary sm:text-[13px]">
                        {CONTACT.email}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={copied ? "Copied" : "Copy email"}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-primary px-3.5 font-heading text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent focus-ring"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-bg-surface px-3 py-1.5 font-heading text-xs text-text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                    Reply in 24h
                  </span>
                  <span className="inline-flex items-center rounded-pill border border-border bg-bg-surface px-3 py-1.5 font-heading text-xs text-text-muted">
                    {ME.location}
                  </span>
                  <span className="inline-flex items-center rounded-pill border border-border bg-bg-surface px-3 py-1.5 font-heading text-xs text-text-muted">
                    Available for freelance
                  </span>
                </div>
              </div>

              {/* socials — compact, not dominant */}
              <div className="flex items-center gap-2.5 pt-1">
                <span className="font-heading text-xs tracking-wide text-text-muted">
                  Or find me on
                </span>
                <span className="h-3 w-px bg-border" aria-hidden />
                <div className="flex items-center gap-2">
                  <SocialIcon
                    href={CONTACT.linkedin}
                    label="LinkedIn"
                    imageSrc="/linkedin.svg"
                  />
                  <SocialIcon
                    href={CONTACT.github}
                    label="GitHub"
                    lucideIcon={Code2}
                  />
                  <SocialIcon
                    href={CONTACT.x}
                    label="X"
                    imageSrc="/x.svg"
                  />
                  <SocialIcon
                    href={`mailto:${CONTACT.email}`}
                    label={`Email ${CONTACT.email}`}
                    lucideIcon={Mail}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT — single clean form card */}
            <div className="relative overflow-hidden rounded-[24px] border border-border bg-bg-surface shadow-sm">
              {/* subtle top accent line */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent"
              />
              <div className="flex flex-col gap-6 p-6 sm:p-8">
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-heading text-base font-semibold tracking-tight text-text-primary">
                    Send a message
                  </h3>
                  <p className="font-body text-sm leading-relaxed text-text-muted">
                    Fill this form or email me directly — I&apos;ll get back
                    within a day.
                  </p>
                </div>

                <ContactForm />
              </div>
            </div>
          </div>

          {/* minimal footer — outside cards, not trapped inside */}
          <div className="mt-12 flex flex-col items-center gap-1 border-t border-border/50 pt-6 text-center sm:mt-16">
            <p className="font-heading text-xs tracking-tight text-text-muted">
              {year} © {ME.name} · {ME.location}
            </p>
            <p className="font-body text-xs text-text-muted/80">
              Built with Next.js · Design crafted with care
            </p>
          </div>
        </div>
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
  lucideIcon?: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
  }>;
  imageSrc?: string;
}): ReactNode {
  const isExternal = href.startsWith("http");
  const props = isExternal
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-bg-primary text-text-secondary transition-colors hover:border-accent hover:text-accent focus-ring"
      {...props}
    >
      {LucideIcon ? (
        <LucideIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      ) : imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          width={14}
          height={14}
          aria-hidden="true"
          className="max-h-[14px] max-w-[14px] object-contain dark:invert"
        />
      ) : null}
    </Link>
  );
}
