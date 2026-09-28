import { ImageResponse } from "next/og";
import { decodeProjectId } from "@/data/projects";
import { getProjectServer } from "@/lib/projects-server";

export const alt = "Project — Mohand Darwish";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ id: string }> };

export default async function Image({ params }: Props) {
  const { id } = await params;
  let title = decodeProjectId(id).replace(/-/g, " ");
  let category = "Project";
  try {
    const project = await getProjectServer(decodeProjectId(id));
    if (project) {
      title = project.title;
      category = project.category;
    }
  } catch {
    // Fall back to the slug-derived title — card always renders.
  }

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
        <div style={{ fontSize: 26, letterSpacing: "0.22em", color: "#ad2831" }}>
          {category.toUpperCase()} · MOHAND DARWISH
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            marginTop: "24px",
          }}
        >
          {title}
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
