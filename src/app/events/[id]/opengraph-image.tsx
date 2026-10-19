import { ImageResponse } from "next/og";
import { getEventWithOrg } from "@/lib/queries";
import { EVENT_TYPE_LABEL, MODE_LABEL, formatDate, formatDateTime } from "@/lib/format";

export const alt = "Event on Got Next";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link-preview card for WhatsApp/Instagram/LinkedIn: title, date, deadline, org, and poster if any. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventWithOrg(id);

  if (!event || event.status === "draft") {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#0f0f0e", color: "#f3f3f0", fontSize: 72, fontWeight: 800 }}>
          Got Next
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#0f0f0e", color: "#f3f3f0", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 64, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ background: "#cdf24a", color: "#0f0f0e", padding: "8px 20px", borderRadius: 999, fontSize: 28, fontWeight: 700 }}>
              {EVENT_TYPE_LABEL[event.type]}
            </span>
            <span style={{ border: "2px solid #f3f3f0", padding: "6px 18px", borderRadius: 999, fontSize: 28 }}>
              {`${MODE_LABEL[event.mode]}${event.city && event.mode !== "online" ? ` · ${event.city}` : ""}`}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: event.title.length > 40 ? 60 : 76, fontWeight: 800, lineHeight: 1.05 }}>{event.title}</div>
            <div style={{ fontSize: 32, opacity: 0.85 }}>{event.org.name}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 30 }}>
            <div style={{ display: "flex" }}>{formatDate(event.startsAt)}</div>
            <div style={{ display: "flex", color: "#cdf24a" }}>{`Sign up by ${formatDateTime(event.regDeadline)}`}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, fontSize: 26, opacity: 0.8 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 18, height: 18, borderRadius: 18, background: i === 3 ? "#cdf24a" : "#f3f3f0" }} />
              ))}
              <span style={{ marginLeft: 8, fontWeight: 800 }}>got next</span>
            </div>
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
