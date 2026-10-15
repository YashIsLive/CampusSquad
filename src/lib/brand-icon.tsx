import { ImageResponse } from "next/og";

/** The "CS" app mark, rendered at any square size (favicons, PWA icons). */
export function brandIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  // Maskable icons get cropped to a circle by Android, so keep the mark inside the safe zone.
  const inset = maskable ? size * 0.1 : 0;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: maskable ? "#1a1714" : "transparent" }}>
        <div
          style={{
            display: "flex",
            flex: 1,
            margin: inset,
            alignItems: "center",
            justifyContent: "center",
            background: "#1a1714",
            borderTop: `${Math.round(size * 0.06)}px solid #c23c17`,
            borderRadius: maskable ? 0 : size * 0.22,
            color: "white",
            fontSize: size * 0.42,
            fontWeight: 800,
            letterSpacing: -size * 0.02,
          }}
        >
          CS
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
