import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span aria-hidden="true" className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="size-6 rounded-full border-2 border-dashed border-rule-strong" />
        ))}
      </span>
      <p className="score text-7xl">404</p>
      <h1 className="text-2xl font-extrabold">Nobody&apos;s here</h1>
      <p className="text-muted-foreground">This page doesn&apos;t exist, or it&apos;s a draft only its organizers can see.</p>
      <Button render={<Link href="/" />}>Back to events</Button>
    </div>
  );
}
