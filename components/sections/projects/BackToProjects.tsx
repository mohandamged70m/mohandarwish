"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Back to archive: history.back() preserves /projects scroll when navigated
 *  from the archive; direct loads fall back to push(/projects). */
export function BackToProjects(): React.ReactNode {
  const router = useRouter();
  return (
    <Link
      href="/projects"
      onClick={(e) => {
        try {
          if (typeof document !== "undefined" && document.referrer.includes("/projects") && window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        } catch {
          // fall through to plain link
        }
      }}
      className="mb-6 inline-flex items-center gap-2 font-heading text-sm text-text-secondary transition-colors duration-300 hover:text-accent focus-ring outline-none"
    >
      <ArrowLeft className="h-4 w-4" />
      All projects
    </Link>
  );
}
