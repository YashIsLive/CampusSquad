import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { requireAdminPageAal } from "@/lib/mfa";
import { relative } from "@/lib/format";
import { idCardViewUrl, reviewableColleges } from "@/lib/verification";
import { EmptyState } from "@/components/empty-state";
import { UserAvatar } from "@/components/user-avatar";
import { ReviewButtons } from "./review-buttons";
import { BackButton } from "@/components/back-button";

export const metadata: Metadata = { title: "Review student IDs", robots: { index: false } };

export default async function ReviewPage() {
  const user = await requireUser({ next: "/verify/review" });
  const colleges = await reviewableColleges(user);
  if (colleges !== "all" && colleges.length === 0) notFound();
  await requireAdminPageAal("/verify/review");

  const requests = await db.query.verificationRequests.findMany({
    where: and(
      eq(schema.verificationRequests.status, "pending"),
      colleges === "all" ? undefined : inArray(schema.verificationRequests.collegeId, colleges),
    ),
    with: {
      user: { columns: { id: true, name: true, username: true, avatarUrl: true, email: true, year: true, branch: true } },
      college: { columns: { name: true } },
    },
    orderBy: asc(schema.verificationRequests.createdAt),
    limit: 50,
  });
  const visible = requests.filter((r) => r.userId !== user.id);
  const urls = await Promise.all(visible.map((r) => idCardViewUrl(r.idCardPath)));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <BackButton fallback="/admin" />
      <header>
        <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">Student ID review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve when the name matches the profile and the card is from the college shown. Photos are deleted once you decide.
          {colleges !== "all" && " You see requests for colleges where you run a verified club."}
        </p>
      </header>

      {visible.length === 0 ? (
        <EmptyState title="Nothing to review" description="New requests show up here and in your notifications." />
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((r, i) => (
            <li key={r.id} className="grid gap-4 rounded-xl border border-rule bg-card p-4 sm:grid-cols-[1fr_16rem]">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <UserAvatar name={r.user.name} src={r.user.avatarUrl} className="size-10" />
                  <div className="min-w-0">
                    <Link href={`/u/${r.user.username}`} className="font-medium hover:underline">
                      {r.user.name || r.user.username}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.college.name}
                      {r.user.year && ` · Year ${r.user.year}`}
                      {r.user.branch && ` · ${r.user.branch}`} · sent {relative(r.createdAt)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Account email: {r.user.email}</p>
                <ReviewButtons requestId={r.id} name={r.user.name || r.user.username} />
              </div>
              {urls[i] ? (
                <a href={urls[i]!} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-rule">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
                  <img src={urls[i]!} alt={`Student ID submitted by ${r.user.name}`} className="max-h-56 w-full bg-muted object-contain" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Photo unavailable. Reject and ask for a new one.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
