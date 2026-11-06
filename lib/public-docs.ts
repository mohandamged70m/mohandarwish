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
  if (path === "Tags/Tags") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object") {
        const e = v as Record<string, unknown>;
        out[k] = {
          Name: e.Name,
          Color: e.Color,
          Icon: e.Icon,
        };
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  if (path === "Tags/Contributors") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object") {
        const e = v as Record<string, unknown>;
        out[k] = {
          Name: e.Name,
          Role: e.Role,
          Image: e.Image,
          "Social Accounts": e["Social Accounts"],
        };
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return data;
}
