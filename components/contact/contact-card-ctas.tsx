"use client";

import { ArrowRight, Check, Copy, FileText } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ME } from "@/Data/me";

/**
 * Deprecated — kept for backward compat. ContactCard no longer uses this.
 * New ContactCard inlines Book a call + copy email with clearer hierarchy.
 * This shim now renders a reduced, accessible set without the hover-only ContactButton.
 */
export function ContactCardCtas(): ReactNode {
  const [copied, setCopied] = useState(false);
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(ME.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copyEmail}
        aria-label={copied ? "Email copied" : `Copy ${ME.email}`}
        className="focus-ring inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border border-border bg-bg-primary px-5 font-heading text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
      >
        {copied ? <Check className="h-4 w-4 text-accent" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy email"}
      </button>

      <Link
        href="/projects"
        className="focus-ring group inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border border-border bg-bg-surface px-5 font-heading text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
      >
        See projects
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </Link>

      <a
        href={ME.cvUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border border-border bg-bg-surface px-5 font-heading text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
      >
        <FileText className="h-4 w-4" aria-hidden />
        Download CV
      </a>
    </div>
  );
}
