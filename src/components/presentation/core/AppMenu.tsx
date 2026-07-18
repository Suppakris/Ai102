"use client";

import {
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Star,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

import { SystemStatusBadge } from "@/components/presentation/core/SystemStatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/provider/theme-provider";

const NAV_ITEMS = [
  { href: "/presentation", label: "Dashboard", icon: LayoutDashboard },
  { href: "/presentation/create", label: "New presentation", icon: Plus },
  { href: "/presentation?tab=favorites", label: "Favorites", icon: Star },
];

export function userInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full md:size-9"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="glass-panel flex w-72 flex-col border-border/60 p-0"
      >
        <SheetHeader className="border-b border-border/60 p-4 text-left">
          <SheetTitle className="brand-gradient-text text-lg font-bold">
            Presentation AI
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => (
            <SheetClose asChild key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            </SheetClose>
          ))}
        </nav>

        <Separator className="bg-border/60" />

        <div className="p-3">
          <ThemeToggle />
        </div>

        <Separator className="bg-border/60" />

        <div className="flex items-center px-4 py-3">
          <SystemStatusBadge />
        </div>

        {/* Account pinned to the bottom */}
        {user && (
          <div className="mt-auto flex items-center gap-3 border-t border-border/60 p-4">
            <Avatar className="size-9 border border-border/60">
              {user.image && <AvatarImage src={user.image} alt="" />}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {userInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive md:size-9"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void signOut({ callbackUrl: "/" })}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
