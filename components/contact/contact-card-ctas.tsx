"use client";

import { ArrowRight, Copy, Check, FileText } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ME } from "@/Data/me";
import { ContactButton } from "./contact-button";

const EASE = [0.22, 1, 0.36, 1] as const;

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
    <LayoutGroup>
      <motion.div
        layout
        transition={{ layout: { duration: 0.55, ease: EASE } }}
        className="mt-2 flex flex-wrap items-center gap-3"
      >
        <ContactButton />

        <motion.div layout transition={{ layout: { duration: 0.55, ease: EASE } }}>
          <button
            type="button"
            onClick={copyEmail}
            className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-bg-primary px-5 py-2.5 font-heading text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy email"}
          </button>
        </motion.div>

        <motion.div layout transition={{ layout: { duration: 0.55, ease: EASE } }}>
          <Link
            href="/projects"
            className="focus-ring group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-bg-surface px-5 py-2.5 font-heading text-sm font-medium text-text-primary shadow-sm transition-colors hover:border-accent hover:text-accent"
          >
            See projects
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </motion.div>

        <motion.div layout transition={{ layout: { duration: 0.55, ease: EASE } }}>
          <a
            href={ME.cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-bg-surface px-5 py-2.5 font-heading text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Download CV
          </a>
        </motion.div>
      </motion.div>
    </LayoutGroup>
  );
}
