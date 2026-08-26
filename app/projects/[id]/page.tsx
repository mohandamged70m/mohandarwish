import { ProjectDetailContent } from "@/components/projects/ProjectDetailContent";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createMetadata } from "@/lib/metadata";
import { PROJECTS } from "@/Data/projects";

type Params = Promise<{ id: string }>;

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ id: project.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) return {};
  return createMetadata({
    title: project.title,
    description:
      project.description ??
      `Project details for ${project.title} — ${project.category}.`,
    path: `/projects/${project.id}`,
  });
}

export default async function ProjectPage({
  params,
}: {
  params: Params;
}): Promise<ReactNode> {
  const { id } = await params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-3xl px-4 pt-32 pb-16 sm:px-6 sm:pt-40 sm:pb-20">
        <Link
          href="/projects"
          transitionTypes={["nav-back"]}
          className="mb-6 inline-flex items-center gap-2 font-heading text-sm text-text-secondary transition-colors duration-300 hover:text-accent focus-ring outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          All projects
        </Link>
        <div className="overflow-hidden rounded-[20px] border border-border bg-bg-surface shadow-[0_18px_56px_rgba(0,0,0,0.45)]">
          <ProjectDetailContent project={project} />
        </div>
      </section>
    </main>
  );
}
