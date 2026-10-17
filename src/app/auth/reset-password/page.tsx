import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-12">
      <p className="label-mono text-muted-foreground">Account</p>
      <h1 className="text-3xl font-extrabold">Set a new password</h1>
      {user ? (
        <>
          <p className="text-sm text-muted-foreground">For {user.email}. You&apos;ll stay signed in.</p>
          <ResetPasswordForm />
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">This reset link has expired or was opened in a different browser. Request a fresh one.</p>
          <Button render={<Link href="/login?mode=forgot" />}>Request a new link</Button>
        </>
      )}
    </div>
  );
}
