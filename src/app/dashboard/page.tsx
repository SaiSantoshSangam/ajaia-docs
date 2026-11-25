import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import DashboardLoading from "@/app/dashboard/loading";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listUserDocuments } from "@/services/documents.service";

async function DashboardContent() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader user={null} />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h1 className="text-lg font-semibold">Supabase Setup Required</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                  and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
                  in <code className="font-mono">.env.local</code> and apply{" "}
                  <code className="font-mono">supabase/migrations/001_initial_schema.sql</code>.
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/">Back home</Link>
                </Button>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  const documents = await listUserDocuments(supabase, {
    id: user.id,
    email: user.email,
  });

  return (
    <DashboardClient
      key={user.id}
      user={{
        id: user.id,
        email: user.email ?? "",
        fullName:
          (user.user_metadata?.full_name as string | undefined) ?? null,
      }}
      initialDocuments={documents}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
