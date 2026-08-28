import { ProjectDetailContent } from "@/components/projects/ProjectDetailContent";
import { ProjectModal } from "@/components/projects/ProjectModal";
import { PROJECTS } from "@/Data/projects";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export default async function InterceptedProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const initialMedia = project.images?.[0] ?? project.videos?.[0] ?? project.image;
  return (
    <ProjectModal backHref="/#projects" marker="root-slot" initialMedia={initialMedia}>
      <ProjectDetailContent project={project} />
    </ProjectModal>
  );
}
