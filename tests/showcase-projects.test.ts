import { expect, it } from "vitest";
import { getShowcaseProject, withShowcaseProjects } from "@/data/showcase-projects";
it("keeps Tarteeb in the archive and direct route without database rows", () => {
  const rows = withShowcaseProjects([]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: "Tarteeb", href: "/projects/Tarteeb", githubUrl: "https://github.com/mohandamged70m/Tarteeb", liveUrl: "https://tarteeb-indol.vercel.app" });
  expect(getShowcaseProject("tarteeb")).toEqual(rows[0]);
  expect(getShowcaseProject("unknown")).toBeNull();
});
it("preserves dashboard edits without duplicating live projects", () => {
  const seed = getShowcaseProject("Tarteeb")!;
  const edited = { ...seed, id: "tarteeb", description: "Edited from the dashboard", listing: 4 };
  const other = { ...seed, id: "Other", title: "Other", listing: 2 };
  const rows = withShowcaseProjects([edited, other]);
  expect(rows).toHaveLength(2);
  expect(rows.find((p) => p.id === "tarteeb")).toBe(edited);
  expect(rows[0].id).toBe("Other");
});
