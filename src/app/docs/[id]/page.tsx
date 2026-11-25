import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import DocumentLoading from "@/app/docs/[id]/loading";
import { DocumentWorkspace } from "@/components/editor/document-workspace";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidParamSchema } from "@/lib/validations/document";
import { AuthorizationError } from "@/services/authorization";
import { getDocumentForUser } from "@/services/documents.service";

async function DocumentContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!uuidParamSchema.safeParse(id).success) {
    notFound();
  }

  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(`/docs/${id}`)}`);
  }

  const headerUser = {
    id: user.id,
    email: user.email ?? "",
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  };

  let document = null;
  let accessError: string | null = null;

  try {
    document = await getDocumentForUser(
      supabase,
      { id: user.id, email: user.email },
      id
    );
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 404) {
      notFound();
    }

    accessError =
      error instanceof AuthorizationError
        ? error.message
        : "You do not have access to this document.";
  }

  if (document) {
    return (
      <DocumentWorkspace
        key={`${document.id}:${document.updatedAt}:${user.id}`}
        initialDocument={document}
        user={headerUser}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={headerUser} />
      <main className="mx-auto max-w-lg px-4 py-20">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">{accessError}</p>
          <Button variant="accent" className="mt-6" asChild>
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<DocumentLoading />}>
      <DocumentContent params={params} />
    </Suspense>
  );
}
