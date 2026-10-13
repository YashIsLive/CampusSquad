/** User-facing messages for errors raised by DB triggers (prefixed "CS:") and app checks. */
const MESSAGES: Record<string, string> = {
  TEAM_FULL: "This team is already at the event's maximum team size.",
  TEAM_NOT_FOUND: "That team no longer exists.",
  CROSS_COLLEGE_NOT_ALLOWED: "This event only allows teams from a single college.",
  ENDORSE_TEAM_MISMATCH: "You can only endorse teammates from this event.",
  ENDORSE_TOO_EARLY: "Endorsements open after the event ends.",
  ENDORSE_NOT_TEAMMATES: "You can only endorse people who were on your team.",
};

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

const UNIQUE_MESSAGES: Record<string, string> = {
  team_members_event_user_uq: "You're already on a team for this event.",
  applications_vacancy_applicant_uq: "You've already applied to this role.",
  registrations_event_user_uq: "You're already registered for this event.",
  teams_event_name_uq: "A team with that name already exists for this event.",
  endorsements_uq: "You've already endorsed this skill for this teammate.",
  invites_pending_uq: "There's already a pending invite for this person.",
  availability_event_user_uq: "You already have a 'looking for a team' post for this event.",
  profiles_username_unique: "That username is taken.",
  organizations_slug_unique: "That organization URL is taken.",
};

/** Turn any thrown error into a message that is safe to show the user. */
export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  const e = err as { message?: string; code?: string; constraint_name?: string; cause?: unknown };
  const inner = (e?.cause ?? e) as { message?: string; code?: string; constraint_name?: string };
  const msg = inner?.message ?? e?.message ?? "";
  const match = /CS:([A-Z_]+)/.exec(msg);
  if (match && MESSAGES[match[1]]) return MESSAGES[match[1]];
  if (inner?.code === "23505" && inner.constraint_name && UNIQUE_MESSAGES[inner.constraint_name]) {
    return UNIQUE_MESSAGES[inner.constraint_name];
  }
  console.error(err);
  return "Something went wrong. Please try again.";
}
