import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-heading text-sm uppercase tracking-[0.14em] text-text-muted">404</p>
      <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-[40ch] font-body text-sm leading-relaxed text-text-secondary">The page you’re looking for doesn’t exist. Try the projects archive or go home.</p>
      <div className="mt-6 flex items-center gap-3">
        <Link href="/" className="focus-ring inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-heading text-sm text-text-on-accent">
          <ArrowLeft className="h-4 w-4" /> Go home
        </Link>
        <Link href="/projects" className="focus-ring inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface px-5 py-2.5 font-heading text-sm text-text-primary hover:border-accent hover:text-accent">
          All projects
        </Link>
      </div>
    </main>
  );
}
