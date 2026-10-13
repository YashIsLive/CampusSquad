import { ImageResponse } from "next/og";
import { getEventWithOrg } from "@/lib/queries";
import { EVENT_TYPE_LABEL, MODE_LABEL, formatDate, formatDateTime } from "@/lib/format";

export const alt = "Event on CampusSquad";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link-preview card for WhatsApp/Instagram/LinkedIn: title, date, deadline, org, and poster if any. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventWithOrg(id);

  if (!event || event.status === "draft") {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#4f46e5", color: "white", fontSize: 72, fontWeight: 700 }}>
          CampusSquad
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "linear-gradient(135deg, #312e81 0%, #4f46e5 60%, #7c3aed 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 64, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ background: "rgba(255,255,255,0.18)", padding: "8px 20px", borderRadius: 999, fontSize: 28 }}>
              {EVENT_TYPE_LABEL[event.type]}
            </span>
            <span style={{ background: "rgba(255,255,255,0.18)", padding: "8px 20px", borderRadius: 999, fontSize: 28 }}>
              {MODE_LABEL[event.mode]}
              {event.city && event.mode !== "online" ? ` · ${event.city}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: event.title.length > 40 ? 60 : 76, fontWeight: 800, lineHeight: 1.05 }}>{event.title}</div>
            <div style={{ fontSize: 32, opacity: 0.85 }}>{event.org.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 30 }}>
            <div>{formatDate(event.startsAt)}</div>
            <div style={{ color: "#fde68a" }}>Register by {formatDateTime(event.regDeadline)}</div>
          </div>
        </div>
        {event.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser
          <img src={event.posterUrl} alt="" width={420} height={630} style={{ objectFit: "cover", width: 420, height: 630 }} />
        )}
      </div>
    ),
    size,
  );
}
