"use client";

import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ user }: { user: { name: string; username: string; avatarUrl: string | null; isAdmin: boolean } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Account menu"
      >
        <UserAvatar name={user.name} src={user.avatarUrl} className="size-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={`/u/${user.username}`} />}>My profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/onboarding" />}>Edit profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/me/events" />}>My events</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/me/applications" />}>Teams & applications</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/events/new" />}>Post an event</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/orgs/new" />}>Create organization</DropdownMenuItem>
        {user.isAdmin && <DropdownMenuItem render={<Link href="/admin" />}>Admin</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
