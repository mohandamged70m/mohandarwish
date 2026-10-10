import type { Doc } from "@/convex/_generated/dataModel";
export type WorkProject = Doc<"workProjects">;
export type Milestone = Doc<"milestones">;
export type Lead = Doc<"leads">;
export type ProjectNote = Doc<"projectNotes">;
export type Workspace = {
  projects: WorkProject[];
  leads: Lead[];
  milestones: Milestone[];
};
