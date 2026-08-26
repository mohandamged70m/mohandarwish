import { Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ME } from "@/Data/me";
import { ContactCardCtas } from "./contact-card-ctas";
import { FadeIn } from "@/components/ui/motion-primitives";

export function ContactCard(): ReactNode {
  return (
    <section id="contact" className="mx-auto my-12 w-full max-w-275 px-6 sm:my-20 sm:px-10">
      <FadeIn>
        <div className="relative w-full overflow-hidden rounded-[20px] border border-border bg-bg-surface p-1.5 shadow-sm">
          <div className="relative w-full overflow-hidden rounded-[16px]">
            <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_20%_50%,var(--accent-ring)_0%,transparent_60%)]" aria-hidden />
            <div className="relative grid gap-8 p-6 sm:gap-10 sm:p-7 md:grid-cols-[1.2fr_1fr] md:items-stretch md:gap-6 md:p-6">
              <div className="flex flex-col gap-5">
                <h2 className="font-heading text-[2.25rem] font-semibold leading-[1.05] tracking-tight text-text-primary sm:text-[2.75rem] lg:text-[3.25rem]">
                  Let&rsquo;s build
                </h2>
                <p className="max-w-[34ch] font-body text-[18px] leading-[1.4] tracking-tight text-text-secondary sm:text-[20px] mb-4">
                  Frontend-leaning full-stack — Next.js, TypeScript, Node. Based in {ME.location} (GMT+2), working worldwide. Open to product teams & freelance.
                </p>
                <ContactCardCtas />
              </div>

              <div className="border-border flex flex-col items-center justify-center gap-6 rounded-[12px] border bg-bg-primary p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <SocialIcon
                    href={`mailto:${ME.email}`}
                    label="Email"
                    lucideIcon={Mail}
                  />
                  <SocialIcon
                    href={ME.socials.linkedin}
                    label="LinkedIn"
                    imageSrc="/linkedin.svg"
                  />
                  <SocialIcon
                    href={ME.socials.github}
                    label="GitHub"
                    imageSrc="/github.svg"
                  />
                </div>
                <div className="flex flex-col items-center gap-2 text-center">
                  <a href={`mailto:${ME.email}`} className="font-heading text-sm text-accent hover:underline underline-offset-4">{ME.email}</a>
                  <p className="font-body text-[13px] tracking-tight text-text-muted">
                    2026 © {ME.name} · Built with Next.js · <a href={ME.socials.github} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-4 hover:text-accent">View source</a>
                  </p>
                  <p className="font-body text-[12px] tracking-tight text-text-muted">
                    Alexandria · Available for new opportunities
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
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
  const props = isExternal
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};
  return (
    <Link
      href={href}
      aria-label={label}
      className="border-border hover:border-border-strong focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl border bg-bg-surface text-text-secondary transition-colors hover:text-accent"
      {...props}
    >
      {LucideIcon ? (
        <LucideIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
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
