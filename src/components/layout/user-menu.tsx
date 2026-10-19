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

export function UserMenu({
  user,
}: {
  user: { name: string; username: string; avatarUrl: string | null; isAdmin: boolean; verified: boolean; reviewer: boolean };
}) {
  return (
    <DropdownMenu>
      {/* Name comes from content (initials + hidden text) so voice control can say what it sees. */}
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <UserAvatar name={user.name} src={user.avatarUrl} className="size-9" />
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={`/u/${user.username}`} />}>My profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/onboarding" />}>Edit profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account" />}>Account and privacy</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/me/events" />}>My events</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/me/applications" />}>My teams</DropdownMenuItem>
        {!user.verified && <DropdownMenuItem render={<Link href="/verify" />}>Get verified</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/events/new" />}>Post an event</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/orgs/new" />}>Add your club</DropdownMenuItem>
        {user.reviewer && <DropdownMenuItem render={<Link href="/verify/review" />}>Review student IDs</DropdownMenuItem>}
        {user.isAdmin && <DropdownMenuItem render={<Link href="/admin" />}>Admin</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
