import { ProjectDetailContent } from "@/components/projects/ProjectDetailContent";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createMetadata } from "@/lib/metadata";
import { decodeProjectId } from "@/Data/projects";
import { getProjectServer, getProjectsServer } from "@/lib/projects-server";

type Params = Promise<{ id: string }>;

export const dynamicParams = true;
export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const projects = await getProjectsServer();
    return projects.map((project) => ({ id: encodeURIComponent(project.id) }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const docId = decodeProjectId(id);
  try {
    const project = await getProjectServer(docId);
    if (!project) return {};
    return createMetadata({
      title: project.title,
      description:
        project.description ??
        `Project details for ${project.title} — ${project.category}.`,
      path: `/projects/${encodeURIComponent(project.id)}`,
    });
  } catch {
    return {};
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Params;
}): Promise<ReactNode> {
  const { id } = await params;
  const docId = decodeProjectId(id);
  let project = null;
  try {
    project = await getProjectServer(docId);
  } catch {
    project = null;
  }
  if (!project) notFound();

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-3xl px-4 pt-32 pb-16 sm:px-6 sm:pt-40 sm:pb-20">
        <Link
          href="/projects"
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
