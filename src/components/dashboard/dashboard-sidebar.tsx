"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  FileText,
  FolderClosed,
  LogOut,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DemoUserSwitcher } from "@/components/auth/demo-user-switcher";
import type { HeaderUser } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type DashboardSection = "recent" | "owned" | "shared";

interface DashboardSidebarProps {
  user: HeaderUser;
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  counts: {
    all: number;
    owned: number;
    shared: number;
  };
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const NAV_ITEMS: Array<{
  id: DashboardSection;
  label: string;
  icon: typeof Clock;
}> = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "owned", label: "My Documents", icon: FolderClosed },
  { id: "shared", label: "Shared with Me", icon: Users },
];

export function DashboardSidebar({
  user,
  activeSection,
  onSelectSection,
  counts,
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
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

  function getCount(section: DashboardSection) {
    if (section === "owned") return counts.owned;
    if (section === "shared") return counts.shared;
    return counts.all;
  }

  const renderSidebarContent = (showCloseButton: boolean) => (
    <div className="flex h-full flex-col justify-between bg-slate-50/85 border-r border-border">
      <div>
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-border/80 px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-85"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Ajaia <span className="text-indigo-600">Docs</span>
            </span>
          </Link>

          {showCloseButton && onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation menu"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-200/70 hover:text-foreground lg:hidden cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Workspace navigation" className="space-y-1 p-3">
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Workspace
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const count = getCount(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onMobileClose?.();
                }}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-white text-indigo-700 shadow-2xs ring-1 ring-slate-200/90"
                    : "text-slate-600 hover:bg-slate-200/50 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-indigo-600" : "text-slate-400"
                    )}
                  />
                  {item.label}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "bg-slate-200/70 text-slate-600"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Account & Switcher Footer */}
      <div className="space-y-3 border-t border-border/80 p-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-white p-2.5 shadow-2xs">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user.fullName || "Ajaia Member"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Switch Account
          </p>
          <DemoUserSwitcher
            currentEmail={user.email}
            variant="list"
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-72 shrink-0 lg:block">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] bg-white shadow-xl">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}

