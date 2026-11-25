"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DemoUserSwitcher } from "@/components/auth/demo-user-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
});

interface AuthFormProps {
  mode: "login" | "signup";
  supabaseConfigured: boolean;
  redirectTo?: string;
}

export function AuthForm({
  mode,
  supabaseConfigured,
  redirectTo = "/dashboard",
}: AuthFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!supabaseConfigured) {
      setError(
        "Supabase environment variables are not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
      );
      return;
    }

    const parsed = isSignup
      ? signupSchema.safeParse({ fullName, email, password })
      : loginSchema.safeParse({ email, password });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your inputs");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
              redirectTo
            )}`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          toast.success("Welcome to Ajaia Docs!");
          router.push(redirectTo);
          router.refresh();
        } else {
          setInfoMessage(
            "Check your inbox to confirm your email address, then sign in."
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        toast.success("Signed in successfully");
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2.5 text-foreground">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <FileText className="h-5 w-5" />
        </div>
        <span className="text-xl font-semibold tracking-tight">
          Ajaia <span className="text-indigo-600">Docs</span>
        </span>
      </Link>

      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle>{isSignup ? "Create your workspace account" : "Sign in to Ajaia Docs"}</CardTitle>
          <CardDescription>
            {isSignup
              ? "Start creating, importing, and sharing rich documents."
              : "Enter your credentials to access your documents."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!supabaseConfigured && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Supabase setup required</p>
                <p className="mt-0.5">
                  Configure <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
                  <code className="font-mono">.env.local</code> and run the SQL migration.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Alex Rivera"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
            </div>

            <Button
              type="submit"
              variant="accent"
              className="w-full"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "New to Ajaia Docs?"}{" "}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="font-medium text-indigo-600 hover:underline"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </Link>
          </p>

          {!isSignup && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Seeded Demo Accounts
              </p>
              <DemoUserSwitcher
                variant="list"
                redirectTo={redirectTo}
                disabled={!supabaseConfigured}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

