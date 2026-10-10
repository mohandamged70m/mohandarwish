const FIELDS = [
  "Description",
  "Problem",
  "Role",
  "Highlights",
  "Metrics",
  "Live Link",
  "Download Link",
  "Project Icon",
  "Repository Link",
  "Contributors",
  "Tags",
  "Stack",
  "Project Images",
  "Listing",
  "listing",
];
export function isPublicPath(path: string) {
  return (
    /^Projects\/[^/]+$/.test(path) ||
    ["Tags/Tags", "Tags/Contributors", "Settings/Developer"].includes(path)
  );
}
export function publicDocument(
  path: string,
  data: Record<string, unknown> | null,
) {
  if (!data || !isPublicPath(path)) return null;
  if (path.startsWith("Projects/"))
    return Object.fromEntries(
      FIELDS.filter((k) => k in data).map((k) => [k, data[k]]),
    );
  if (path === "Settings/Developer")
    return {
      featuredRepos: Array.isArray(data.featuredRepos)
        ? data.featuredRepos
        : [],
    };
  return data;
}
