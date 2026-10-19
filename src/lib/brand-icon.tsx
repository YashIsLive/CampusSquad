import { ImageResponse } from "next/og";

/** The ●●●○ app mark, rendered at any square size (favicons, PWA icons). */
export function brandIcon(size: number, { maskable = false }: { maskable?: boolean } = {}) {
  // Maskable icons get cropped to a circle by Android, so keep the mark inside the safe zone.
  const inset = maskable ? size * 0.14 : 0;
  const dot = (size - inset * 2) * 0.27;
  const gap = (size - inset * 2) * 0.06;
  const Dot = ({ open }: { open?: boolean }) => (
    <div style={{ width: dot, height: dot, borderRadius: dot, background: open ? "#cdf24a" : "#f3f3f0" }} />
  );
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: maskable ? "#0f0f0e" : "transparent" }}>
        <div
          style={{
            display: "flex",
            flex: 1,
            margin: inset,
            alignItems: "center",
            justifyContent: "center",
            background: "#0f0f0e",
            borderRadius: maskable ? 0 : size * 0.25,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap }}>
            <div style={{ display: "flex", gap }}>
              <Dot />
              <Dot />
            </div>
            <div style={{ display: "flex", gap }}>
              <Dot />
              <Dot open />
            </div>
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
