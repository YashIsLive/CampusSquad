export type TourKey = "feed" | "event" | "team" | "manage";

export type TourStep = {
  /** Matches a `data-tour="…"` attribute on the page. Steps whose target isn't on screen are skipped. */
  id: string;
  title: string;
  /** One or two short sentences: what this is and why it matters to you. */
  body: string;
  /** Optional nudge to actually use it ("Try it: …"). */
  tryIt?: string;
};

export type Tour = {
  label: string;
  /** Shown once, before the first automatic run: what the tour covers. */
  intro: { title: string; body: string };
  steps: TourStep[];
};

/** What each page's tour points at, in order. Written to answer "what can I do here?". */
export const TOURS: Record<TourKey, Tour> = {
  feed: {
    label: "Explore",
    intro: {
      title: "Welcome to CampusSquad",
      body: "This is where every hackathon, contest and workshop near you shows up. Take a 30-second look around?",
    },
    steps: [
      { id: "scope", title: "Start with your campus", body: "See what's on at your college, in your city, or anywhere in India.", tryIt: "Tap “All India” to see everything." },
      { id: "search", title: "Search events and clubs", body: "Type a name, a club or a topic like “AI”.", tryIt: "Press / on your keyboard to jump here." },
      { id: "types", title: "Filter by type", body: "Only want hackathons? Pick one. “More filters” adds deadline, fee, online/offline and beginner-friendly." },
      { id: "event-card", title: "Every event, at a glance", body: "Date, how you take part and how long registration stays open. Open one for details and its team board." },
      { id: "save", title: "Save it for later", body: "We'll remind you 24 hours before registration closes.", tryIt: "Tap the bookmark on any card." },
      { id: "notifications", title: "Your notifications", body: "Applications, invites, messages and reminders arrive here the moment they happen." },
      { id: "teams-nav", title: "Your teams", body: "Teams you're on, roles you applied to, invites and messages from team leaders." },
      { id: "mobile-nav", title: "Getting around", body: "Explore, your events, posting an event, and your teams are always one tap away." },
      { id: "guide", title: "Replay any time", body: "This ? menu has every tour and your getting-started checklist." },
    ],
  },
  event: {
    label: "Event page",
    intro: {
      title: "How an event page works",
      body: "Register, find teammates and keep track of the date, all from here. Quick tour?",
    },
    steps: [
      { id: "facts", title: "The essentials", body: "When and where, who can join, team size and fee." },
      { id: "ticket", title: "Register here", body: "After you register this becomes your ticket, with a check-in code to show at the door." },
      { id: "event-tabs", title: "Need a team?", body: "The Teams tab lists open roles from teams at this event, and students looking for a team." },
      { id: "roles", title: "Roles ranked for you", body: "Each role shows how well your skills match it. A check mark means you have that skill.", tryIt: "Apply with a short pitch; the leader can message you back." },
      { id: "looking", title: "Or let teams find you", body: "Post a “looking for a team” card and leaders can invite you directly." },
      { id: "calendar", title: "Put it in your calendar", body: "One tap adds the event to Google Calendar." },
    ],
  },
  team: {
    label: "Team page",
    intro: {
      title: "Your team's home",
      body: "Recruit, plan and chat with your team here. A quick look?",
    },
    steps: [
      { id: "members", title: "Who's on the team", body: "Members and their top skills. You'll see a warning if you're below the event's minimum team size." },
      { id: "post-role", title: "Post a role you're missing", body: "Choose the skills you need. Applicants are ranked by how well they match." },
      { id: "review", title: "Review applications", body: "Shortlist, accept or reject, and message applicants. They can reply, and the conversation stays with the application." },
      { id: "suggestions", title: "People who fit", body: "Students at this event without a team, ranked against your open roles.", tryIt: "Invite someone in one tap." },
      { id: "checklist", title: "Shared checklist", body: "Split the work. Everyone sees ticks as they happen." },
      { id: "chat", title: "Team chat", body: "Only your team can see it, and it stays open after the event." },
    ],
  },
  manage: {
    label: "Organizer dashboard",
    intro: {
      title: "Your event dashboard",
      body: "See who's signing up, help people form teams and run check-in. Quick tour?",
    },
    steps: [
      { id: "stats", title: "Your funnel", body: "Views → registrations → teams → check-ins, updated live." },
      { id: "nudge", title: "Help solo students team up", body: "One tap tells everyone without a team where the open roles are." },
      { id: "manage-tabs", title: "Share kit, registrants and check-in", body: "Tracked links and QR codes for each WhatsApp group, the registrant list with CSV export, and check-in with your phone camera." },
      { id: "announce", title: "Announce changes", body: "Venue moved? Problem statements out? Notify every registrant at once." },
    ],
  },
};
