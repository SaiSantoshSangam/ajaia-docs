"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEMO_ACCOUNTS } from "@/lib/demo-users";

interface DemoUserSwitcherProps {
  currentEmail?: string | null;
  redirectTo?: string;
  variant?: "dropdown" | "list";
  disabled?: boolean;
}

export function DemoUserSwitcher({
  currentEmail,
  redirectTo,
  variant = "dropdown",
  disabled = false,
}: DemoUserSwitcherProps) {
  const router = useRouter();
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);

  async function handleSwitch(email: string) {
    setSwitchingEmail(email);
    try {
      const res = await fetch("/api/auth/demo-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Could not switch demo account");
        return;
      }

      toast.success(`Signed in as ${data.user.fullName || data.user.email}`);
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      toast.error("Network error switching demo account");
    } finally {
      setSwitchingEmail(null);
    }
  }

  if (variant === "list") {
    return (
      <div className="space-y-2">
        {DEMO_ACCOUNTS.map((account) => {
          const isCurrent =
            currentEmail?.toLowerCase() === account.email.toLowerCase();
          const isBusy = switchingEmail === account.email;

          return (
            <button
              key={account.id}
              type="button"
              disabled={disabled || switchingEmail !== null}
              onClick={() => handleSwitch(account.email)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {account.fullName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {account.email} &middot; {account.summary}
                </p>
              </div>
              {isBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
              ) : isCurrent ? (
                <Check className="h-4 w-4 shrink-0 text-indigo-600" />
              ) : (
                <span className="shrink-0 text-xs font-medium text-indigo-600">
                  Switch
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || switchingEmail !== null}
          className="gap-1.5"
          aria-label="Demo account switcher"
        >
          {switchingEmail ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Users className="h-3.5 w-3.5 text-indigo-600" />
          )}
          <span className="hidden md:inline">Demo User</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2.5 py-1.5">
          <p className="text-xs font-semibold text-foreground">
            Switch Seeded Demo Account
          </p>
          <p className="text-[11px] text-muted-foreground">
            Authenticates via Supabase Auth session cookies
          </p>
        </div>
        <DropdownMenuSeparator />
        {DEMO_ACCOUNTS.map((account) => {
          const isCurrent =
            currentEmail?.toLowerCase() === account.email.toLowerCase();
          return (
            <DropdownMenuItem
              key={account.id}
              onClick={() => handleSwitch(account.email)}
              className="flex items-start justify-between gap-2 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {account.fullName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {account.email}
                </p>
                <p className="line-clamp-1 text-[11px] text-muted-foreground/90">
                  {account.summary}
                </p>
              </div>
              {isCurrent && (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

