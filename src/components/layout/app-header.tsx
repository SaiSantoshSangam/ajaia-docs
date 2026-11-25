"use client";

import Link from "next/link";
import { FileText, LogOut, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DemoUserSwitcher } from "@/components/auth/demo-user-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface HeaderUser {
  id: string;
  email: string;
  fullName?: string | null;
}

export function UserMenu({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const initials = (user.fullName || user.email || "U")
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  async function handleSignOut() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-full pl-1.5 pr-3"
          aria-label="Account menu"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
            {initials}
          </span>
          <span className="hidden max-w-[160px] truncate text-xs font-medium sm:inline">
            {user.fullName || user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium text-foreground">
            {user.fullName || "Ajaia Member"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader({
  user,
  rightSlot,
}: {
  user: HeaderUser | null;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-85"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <FileText className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">
            Ajaia <span className="text-indigo-600">Docs</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {rightSlot}
          {user ? (
            <>
              <DemoUserSwitcher currentEmail={user.email} />
              <UserMenu user={user} />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button variant="accent" size="sm" asChild>
                <Link href="/signup">Get started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

