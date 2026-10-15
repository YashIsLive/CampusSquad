import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <p className="text-5xl font-semibold text-signal-ink">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">It may have been removed, or it&apos;s a draft only organizers can see.</p>
      <Button render={<Link href="/" />}>Back to events</Button>
    </div>
  );
}
