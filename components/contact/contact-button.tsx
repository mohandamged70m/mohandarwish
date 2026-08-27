"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ME } from "@/Data/me";

/**
 * Accessible email copy button — always shows email, no hover-only reveal.
 * Fixed: uses ME.email (was hardcoded hello@example.com), meets 44px touch target,
 * keyboard operable, reduced-motion safe.
 */
export function ContactButton(): ReactNode {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(ME.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
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
        window.setTimeout(() => setCopied(false), 1800);
      } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Email copied" : `Copy email ${ME.email}`}
      className="focus-ring inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
    >
      {copied ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <Mail className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="tabular-nums">{copied ? "Copied!" : ME.email}</span>
      <span aria-hidden className="inline-flex">
        {copied ? null : <Copy className="h-3.5 w-3.5 opacity-60" />}
      </span>
    </button>
  );
}
