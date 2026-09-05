import { ProjectDetailContent } from "@/components/projects/ProjectDetailContent";
import { ProjectModal } from "@/components/projects/ProjectModal";
import { decodeProjectId } from "@/Data/projects";
import { getProjectServer } from "@/lib/projects-server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const dynamicParams = true;
export const revalidate = 60;

export default async function InterceptedProjectPage({
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

  const initialMedia = project.images?.[0] ?? project.videos?.[0] ?? project.image;
  return (
    <ProjectModal backHref="/#projects" marker="root-slot" initialMedia={initialMedia}>
      <ProjectDetailContent project={project} />
    </ProjectModal>
  );
}
