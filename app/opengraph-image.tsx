import { ImageResponse } from "next/og";

export const alt = "Mohand Darwish — Software Engineer, Full-Stack Frontend-leaning";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
            ALEXANDRIA · GMT+2 · WORLDWIDE
          </div>
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
          Mohand Darwish
        </div>
        <div style={{ fontSize: 38, color: "#d6d3d1", marginTop: "20px" }}>
          Software Engineer — Full-Stack, Frontend-leaning
        </div>
        <div style={{ fontSize: 30, color: "#a8a29e", marginTop: "12px" }}>
          Next.js · TypeScript · Node
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
