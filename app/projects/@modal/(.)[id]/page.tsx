import { ProjectDetailContent } from "@/components/projects/ProjectDetailContent";
import { ProjectModal } from "@/components/projects/ProjectModal";
import { PROJECTS } from "@/Data/projects";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export default async function InterceptedProjectFromArchive({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  return (
    <ProjectModal backHref="/projects" marker="projects-slot">
      <ProjectDetailContent project={project} />
    </ProjectModal>
  );
}
