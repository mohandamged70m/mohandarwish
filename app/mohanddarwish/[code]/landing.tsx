"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Briefcase, FileText, Loader2 } from "lucide-react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  updateDoc,
  where,
} from "@/lib/dash-db";
import { db } from "@/lib/dash-db";
import { TrackView } from "@/components/dashboard/TrackView";
import type { LinkDoc } from "@/lib/analytics-types";

type Status = "loading" | "found" | "missing";

/**
 * Personalised landing for a Trails share link (/mohanddarwish/[code]).
 * Looks the link up by its Code, counts the open, and renders the owner's
 * greeting + pinned projects. Unknown codes get a graceful fallback home.
 */
export default function TailoredLanding({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [link, setLink] = useState<LinkDoc | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);

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
        setLink(data);
        setPinned(Array.isArray(data.Tailor?.Pinned) ? data.Tailor.Pinned.slice(0, 12) : []);
        setStatus("found");
        // Count the open (best-effort; never blocks the page).
        try {
          await updateDoc(doc(db, "Analytics", "Links", "Items", hit.id), {
            Opens: Number(data.Opens || 0) + 1,
            LastOpenAt: Date.now(),
          });
          const totalsSnap = await getDoc(doc(db, "Analytics", "Totals"));
          const totals = totalsSnap.exists() ? totalsSnap.data() : {};
          await updateDoc(doc(db, "Analytics", "Totals"), {
            LinkOpens: Number(totals.LinkOpens || 0) + 1,
          });
        } catch {
          // analytics must never break the page
        }
      } catch {
        if (!cancelled) setStatus("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="mx-auto flex min-h-[80svh] w-full max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      <TrackView path={`/mohanddarwish/${code}`} />

      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin" />
          Opening your link…
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

      {status === "found" && link && (
        <>
          <p className="font-heading text-xs uppercase tracking-widest text-text-muted">
            Mohand Darwish {link.For ? `· for ${link.For}` : ""}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
            {link.Tailor?.Greeting || `Hello${link.For ? `, ${link.For}` : ""} — glad you're here.`}
          </h1>

          {pinned.length > 0 && (
            <div className="mt-8 flex w-full flex-col gap-2">
              <p className="font-heading text-[11px] font-bold uppercase tracking-widest text-text-muted">
                Hand-picked for you
              </p>
              {pinned.map((id) => (
                <Link
                  key={id}
                  href={`/projects/${encodeURIComponent(id)}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-surface px-4 py-3 text-left transition-colors hover:border-accent"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Briefcase size={16} className="shrink-0 text-accent" />
                    <span className="truncate text-sm font-bold text-text-primary">{id}</span>
                  </span>
                  <ArrowUpRight
                    size={16}
                    className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </Link>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-text-on-accent"
            >
              Explore the full portfolio
            </Link>
            {link.Tailor?.AutoCv && (
              <a
                href="/cv.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-surface px-6 py-3 text-sm font-bold text-text-primary"
              >
                <FileText size={16} />
                Attached CV
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
