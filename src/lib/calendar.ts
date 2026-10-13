import { siteUrl } from "@/lib/format";

const gcalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** "Add to Google Calendar" template link. Works without any API keys. */
export function googleCalendarUrl(event: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  venue: string | null;
  mode: string;
  regDeadline: Date;
}) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${gcalDate(event.startsAt)}/${gcalDate(event.endsAt)}`,
    details: `Register by ${event.regDeadline.toUTCString()}.\n${siteUrl()}/events/${event.id}`,
    location: event.mode === "online" ? "Online" : (event.venue ?? ""),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
