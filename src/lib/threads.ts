import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * An application's conversation, if `userId` is a party to it (the applicant or the team leader).
 * Returns null otherwise, so callers can 404 without revealing that the application exists.
 */
export async function loadApplicationThread(applicationId: string, userId: string) {
  const application = await db.query.applications.findFirst({
    where: eq(schema.applications.id, applicationId),
    with: {
      applicant: { columns: { id: true, name: true, username: true, avatarUrl: true } },
      vacancy: {
        with: {
          team: {
            with: {
              event: { columns: { id: true, title: true } },
              leader: { columns: { id: true, name: true, username: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!application) return null;
  const { vacancy } = application;
  const isLeader = vacancy.team.leaderId === userId;
  const isApplicant = application.applicantId === userId;
  if (!isLeader && !isApplicant) return null;
  return { application, vacancy, team: vacancy.team, event: vacancy.team.event, leader: vacancy.team.leader, applicant: application.applicant, isLeader };
}

export async function threadMessages(applicationId: string) {
  return db.query.applicationMessages.findMany({
    where: eq(schema.applicationMessages.applicationId, applicationId),
    with: { sender: { columns: { id: true, name: true, avatarUrl: true } } },
    orderBy: asc(schema.applicationMessages.createdAt),
  });
}
