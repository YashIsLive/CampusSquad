import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function UserAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <Avatar className={cn("@container", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-secondary font-display text-[36cqw] font-bold text-foreground">{initials(name || "?")}</AvatarFallback>
    </Avatar>
  );
}
