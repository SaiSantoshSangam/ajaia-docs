import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/env";

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const params = await searchParams;
  const redirectTo =
    params.redirectTo && params.redirectTo.startsWith("/")
      ? params.redirectTo
      : "/dashboard";

  return (
    <AuthForm
      mode="login"
      supabaseConfigured={isSupabaseConfigured()}
      redirectTo={redirectTo}
    />
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
