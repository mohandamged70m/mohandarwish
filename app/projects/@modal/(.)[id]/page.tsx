import { ProjectDetailContent } from "@/components/projects/ProjectDetailContent";
import { ProjectModal } from "@/components/projects/ProjectModal";
import { decodeProjectId } from "@/Data/projects";
import { getProjectServer } from "@/lib/projects-server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const dynamicParams = true;
export const revalidate = 60;

export default async function InterceptedProjectFromArchive({
  params,
}: {
  params: Promise<{ id: string }>;
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
    <ProjectModal backHref="/projects" marker="projects-slot">
      <ProjectDetailContent project={project} />
    </ProjectModal>
  );
}
