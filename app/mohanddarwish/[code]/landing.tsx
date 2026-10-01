"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
} from "@/lib/dash-db";
import { db } from "@/lib/dash-db";
import { requestCvOpen } from "@/components/cv/CvModal";
import { stashTailor } from "@/lib/analytics/tailor";
import type { LinkDoc } from "@/lib/analytics-types";

type Status = "loading" | "redirecting" | "missing";

// HR / recruiter audiences come to read the CV, not the portfolio.
// Matches "HR", "HR Manager", "Recruiter", "Talent Acquisition", "Hiring Manager"
// (word-boundary on HR so names like "Christina" don't match).
const HR_RE = /\bhr\b|human resources|recruit\w*|talent acquisition|talent|hiring manager|hiring/i;

/** A link pops the CV modal (on top of the portfolio) when toggled, or when it's for HR. */
export function wantsAutoCv(link: LinkDoc): boolean {
  if (link.Tailor?.AutoCv === true) return true;
  return HR_RE.test(link.Name || "") || HR_RE.test(link.For || "");
}

/**
 * Share-link resolver (/mohanddarwish/[code]).
 *
 * Every link opens the portfolio itself: the code is looked up, the visit is
 * attributed to the link (so Trails shows exactly who came from which link), the
 * link's tailoring is stashed for the portfolio, then the visitor is handed to `/`.
 * Unknown codes get a graceful fallback home.
 *
 * It counts nothing. The open is counted by /api/track when the visit is actually
 * recorded — for a real, non-owner, non-bot recipient with a session that survived.
 * Counting it here instead counted prefetches, bots and the owner's own testing, and
 * left the link's own "opens" and "visits" disagreeing with each other.
 */
export default function TailoredLanding({ code }: { code: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  // Handoff must fire once per link open (StrictMode double-invokes effects).
  const fired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getDocs(
          query(collection(db, "Analytics", "Links", "Items"), where("Code", "==", code)),
        );
        if (cancelled) return;
        const hit = found.docs[0];
        if (!hit) {
          setStatus("missing");
          return;
        }
        const data = hit.data() as LinkDoc;
        // Attribute this visit to the link: a backup in sessionStorage (the tracker
        // picks it up when it starts) + a live handoff with retries (this page effect
        // runs before the layout tracker's mount effect, which may not have happened
        // yet, and which may never start if the code is stale).
        const linkJson = JSON.stringify({
          Id: code,
          Name: data.Name || "",
          For: data.For || "",
        });
        try {
          sessionStorage.setItem("trails_link", linkJson);
        } catch {
          // private mode — the live handoff below still covers us
        }
        // What this link asks the portfolio to do differently. Stashed before the
        // hand-off so `/` is already tailored when it mounts.
        stashTailor(
          {
            AutoCv: wantsAutoCv(data),
            Greeting: data.Tailor?.Greeting || "",
            Pinned: Array.isArray(data.Tailor?.Pinned) ? data.Tailor!.Pinned : [],
          },
          { Name: data.Name || "", For: data.For || "" }
        );
        const attribute = (tries: number) => {
          try {
            const api = (
              window as unknown as { __trails?: { track: (k: string, v?: string) => void } }
            ).__trails;
            if (api) api.track("link", linkJson);
            else if (tries > 0) {
              window.setTimeout(() => {
                if (!cancelled) attribute(tries - 1);
              }, 500);
            }
          } catch {
            // never break the page
          }
        };
        attribute(3);
        // Everyone lands on the portfolio. HR / AutoCv links get the CV
        // modal on top of it. The layout (CvModalHost + TrailsTracker)
        // persists across the client-side navigation, so the modal opens on
        // the portfolio and the visit keeps its link attribution.
        const autoCv = !fired.current && wantsAutoCv(data);
        if (autoCv) fired.current = true;
        setStatus("redirecting");
        window.setTimeout(() => {
          if (cancelled) return;
          router.replace("/");
          if (autoCv) {
            // Let the portfolio mount before popping the modal.
            window.setTimeout(() => {
              if (!cancelled) requestCvOpen();
            }, 700);
          }
        }, 450);
      } catch {
        if (!cancelled) setStatus("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <div className="mx-auto flex min-h-[80svh] w-full max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      {/* page-view + link-open counted by the global TrailsTracker in layout */}

      {(status === "loading" || status === "redirecting") && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin" />
          {status === "loading" ? "Opening your link…" : "Opening your portfolio…"}
        </div>
      )}

      {status === "missing" && (
        <>
          <p className="font-heading text-xs uppercase tracking-widest text-text-muted">
            Link not found
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-text-primary sm:text-4xl">
            This link has expired or never existed.
          </h1>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-text-on-accent"
          >
            <ArrowLeft size={16} />
            Back to the portfolio
          </Link>
        </>
      )}
    </div>
  );
}
