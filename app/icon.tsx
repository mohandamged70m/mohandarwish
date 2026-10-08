import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "112px",
          // Hairline wine frame mirrors public/logo.svg.
          border: "3px solid rgba(173,40,49,0.5)",
          color: "#fff7ed",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 220,
          fontWeight: 800,
          letterSpacing: "-0.04em",
        }}
      >
        {/* Ember (not wine): #ad2831 text on black fails AA — see DESIGN.md §7. */}
        M<span style={{ color: "#e8624a" }}>D</span>
      </div>
    ),
    { ...size },
  );
}
