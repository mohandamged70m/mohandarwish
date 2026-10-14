import { expect, it } from "vitest";
import { getShowcaseProject, withShowcaseProjects } from "@/data/showcase-projects";
import type { Project } from "@/data/projects";

const make = (over: Partial<Project> & { id: string }): Project => ({
  title: over.id,
  category: "Full-Stack",
  image: "/me/mohand-darwish.jpeg",
  href: `/projects/${over.id}`,
  ...over,
});

it("returns only dashboard projects (no hardcoded showcase)", () => {
  expect(withShowcaseProjects([])).toHaveLength(0);
  expect(getShowcaseProject("tarteeb")).toBeNull();
  expect(getShowcaseProject("unknown")).toBeNull();
});

it("preserves dashboard projects and sorts by listing", () => {
  const edited = make({ id: "tarteeb", description: "Edited from the dashboard", listing: 4 });
  const other = make({ id: "Other", title: "Other", listing: 2 });
  const rows = withShowcaseProjects([edited, other]);
  expect(rows).toHaveLength(2);
  expect(rows.find((p) => p.id === "tarteeb")).toBe(edited);
  expect(rows[0].id).toBe("Other");
});
