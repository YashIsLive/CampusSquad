import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Add your club" };

export default async function NewOrgPage() {
  const user = await requireUser({ next: "/orgs/new" });

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <h1 className="text-4xl leading-[0.95] font-black sm:text-5xl">Add your club</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A club, department or community that hosts events. You&apos;ll be its owner and can add admins.
      </p>
      {user.collegeVerified && user.college ? (
        <OrgForm userId={user.id} collegeName={user.college.name} />
      ) : (
        <div className="mt-6">
          <EmptyState
            title="Verification needed"
            description="Only verified students can add a club. Verify with your college email, your student ID, or two classmates."
            action={
              <Button render={<Link href="/verify" />}>
                Get verified
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
