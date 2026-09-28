import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          borderRadius: "40px",
          color: "#faf6f0",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: "-0.04em",
        }}
      >
        M<span style={{ color: "#ad2831" }}>D</span>
      </div>
    ),
    { ...size },
  );
}
