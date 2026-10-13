import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicLinkForm } from "./magic-link-form";

const DEMO_USERS = [
  { handle: "riya", label: "Riya — organizer, COEP AI Club" },
  { handle: "aarav", label: "Aarav — solo participant" },
  { handle: "neha", label: "Neha — team leader" },
  { handle: "dev", label: "Dev — team leader, PICT" },
  { handle: "meera", label: "Meera — applicant, PICT" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : null;
  if (await getCurrentUser()) redirect(next);
  const demo = process.env.E2E_TEST_LOGIN === "1" && process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in to CampusSquad</CardTitle>
          <CardDescription>
            Use your college email to get a verified badge for your campus.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <form action={signInWithGoogle.bind(null, next)}>
            <Button type="submit" variant="outline" className="h-10 w-full">
              Continue with Google
            </Button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <MagicLinkForm next={next} />
        </CardContent>
      </Card>

      {demo && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Demo login (dev only)</CardTitle>
            <CardDescription>Sign in as a seed user without email.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {DEMO_USERS.map((u) => (
              <Link
                key={u.handle}
                href={`/api/test-login?u=${u.handle}&next=${encodeURIComponent(next)}`}
                prefetch={false}
                className="rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                {u.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
