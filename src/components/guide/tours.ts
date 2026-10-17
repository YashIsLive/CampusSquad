export type TourKey = "feed" | "event" | "team" | "manage";

export type TourStep = {
  /** Matches a `data-tour="…"` attribute on the page. Steps whose target isn't on screen are skipped. */
  id: string;
  title: string;
  body: string;
};

/** What each page's tour points at, in order. Written to answer "what can I do here?". */
export const TOURS: Record<TourKey, { label: string; steps: TourStep[] }> = {
  feed: {
    label: "Explore",
    steps: [
      { id: "scope", title: "Your campus first", body: "Switch between events on your campus, around your city, and across India." },
      { id: "search", title: "Search anything", body: "Event names and clubs. Press / from anywhere on this page to jump here." },
      { id: "types", title: "Narrow it down", body: "Pick a type, or open more filters for deadline, fee, mode and beginner-friendly events." },
      { id: "event-card", title: "Read a card at a glance", body: "Start date, how you take part, and how long registration stays open. Open one for details and the team board." },
      { id: "save", title: "Save it for later", body: "Saved events get a reminder 24 hours before registration closes — so you don't miss it." },
      { id: "notifications", title: "Everything new lands here", body: "Applications, invites, announcements and reminders, live as they happen." },
      { id: "teams-nav", title: "Your teams", body: "Teams you're on, roles you've applied to and invites — all in one place." },
      { id: "mobile-nav", title: "Get around", body: "Explore, your events, post an event, and your teams — always one tap away." },
      { id: "guide", title: "Lost? Ask for a tour", body: "Replay this tour or open your getting-started list here, any time." },
    ],
  },
  event: {
    label: "Event page",
    steps: [
      { id: "facts", title: "The essentials", body: "When and where, who can join, team size and fee — all in one spec sheet." },
      { id: "ticket", title: "Register here", body: "Once you're in, this turns into your ticket, with a check-in code for the door." },
      { id: "event-tabs", title: "Find teammates", body: "The Teams tab lists open roles you can apply to and people looking for a team." },
      { id: "roles", title: "Roles ranked for you", body: "Each role shows how well your skills match. A check mark means you have that skill." },
      { id: "looking", title: "Or let them find you", body: "Post a “looking for a team” card and team leaders can invite you directly." },
      { id: "calendar", title: "Never miss it", body: "Add the event to your calendar in one tap." },
    ],
  },
  team: {
    label: "Team page",
    steps: [
      { id: "members", title: "Your team", body: "Everyone on the team with their top skills. The badge warns if you're below the event's minimum size." },
      { id: "post-role", title: "Post the roles you're missing", body: "Pick required skills — applicants are ranked by how well they match." },
      { id: "review", title: "Review applications", body: "Shortlist, message, accept or reject. Accepting adds them to the team instantly." },
      { id: "suggestions", title: "People who fit", body: "Students at this event without a team, ranked against your open roles. Invite in one tap." },
      { id: "checklist", title: "Shared checklist", body: "Split the work. Everyone on the team sees updates live." },
      { id: "chat", title: "Team chat", body: "Private to members, and it stays open after the event so good teams can stick together." },
    ],
  },
  manage: {
    label: "Organizer dashboard",
    steps: [
      { id: "stats", title: "Your funnel", body: "Views → registrations → teams → check-ins, updated as people sign up." },
      { id: "nudge", title: "Help solo students team up", body: "One tap tells everyone without a team where the open roles are." },
      { id: "manage-tabs", title: "Share kit and check-in", body: "Tracked links and QR codes per WhatsApp group, the registrant list with CSV export, and phone-camera check-in." },
      { id: "announce", title: "Announce changes", body: "Venue moved? Problem statements out? Notify every registrant at once." },
    ],
  },
};
