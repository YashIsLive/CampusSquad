import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Create organization" };

export default async function NewOrgPage() {
  const user = await requireUser({ next: "/orgs/new" });

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Create an organization</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A club, department or community that hosts events. You&apos;ll be its owner and can add admins.
      </p>
      {user.collegeVerified && user.college ? (
        <OrgForm userId={user.id} collegeName={user.college.name} />
      ) : (
        <div className="mt-6">
          <EmptyState
            title="Verification needed"
            description="Only students verified by their college email can create organizations. Sign in with your college email, or pick your college in your profile if your email already matches."
            action={
              <Button render={<Link href="/onboarding" />} variant="outline">
                Check my profile
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
