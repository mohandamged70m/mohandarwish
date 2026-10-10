import { ImageResponse } from "next/og";
import { decodeProjectId } from "@/data/projects";
import { getProjectServer } from "@/lib/projects-server";

export const alt = "Project by Mohand Darwish — Software Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-project share card: project title + category + stack on the wine
// system. Falls back to the generic site card when the project is missing,
// so a share never 500s on a stale id.
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let title = "Mohand Darwish";
  let eyebrow = "ALEXANDRIA · GMT+2 · WORLDWIDE";
  let sub = "Software Engineer | AI Product Builder";
  try {
    const { id } = await params;
    const project = await getProjectServer(decodeProjectId(id));
    if (project) {
      title = project.title;
      eyebrow = `MOHAND DARWISH — ${project.category.toUpperCase()}`;
      sub = project.stack?.slice(0, 4).join(" · ") || "Case study";
    }
  } catch {
    // fallback art below
  }

  const titleSize = title.length > 44 ? 54 : title.length > 24 ? 70 : 88;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0a",
          color: "#faf6f0",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "9999px",
              background: "#ad2831",
            }}
          />
          <div style={{ fontSize: 26, letterSpacing: "0.22em", color: "#a8a29e" }}>
            {eyebrow}
          </div>
        </div>
        <div style={{ fontSize: titleSize, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          {title}
        </div>
        <div style={{ fontSize: 34, color: "#d6d3d1", marginTop: "20px" }}>
          {sub}
        </div>
        <div
          style={{
            marginTop: "40px",
            height: "4px",
            width: "220px",
            background: "linear-gradient(to right, #ad2831, transparent)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
