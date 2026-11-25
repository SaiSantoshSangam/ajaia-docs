import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import DocumentLoading from "@/app/docs/[id]/loading";
import { DocumentWorkspace } from "@/components/editor/document-workspace";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidParamSchema } from "@/lib/validations/document";
import { AuthorizationError } from "@/services/authorization";
import { getDocumentByShareToken } from "@/services/documents.service";

async function SharedDocumentContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!uuidParamSchema.safeParse(token).success) {
    notFound();
  }

  if (!isSupabaseConfigured()) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headerUser = user
    ? {
        id: user.id,
        email: user.email ?? "",
        fullName:
          (user.user_metadata?.full_name as string | undefined) ?? null,
      }
    : null;

  let document = null;
  let unavailable = false;

  try {
    document = await getDocumentByShareToken(
      supabase,
      user ? { id: user.id, email: user.email } : null,
      token
    );
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 404) {
      unavailable = true;
    } else {
      throw error;
    }
  }

  if (unavailable || !document) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader user={headerUser} />
        <main className="mx-auto max-w-lg px-4 py-20">
          <Card className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Share link unavailable
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This link may have been disabled, rotated, or the document no
              longer exists.
            </p>
            <Button variant="accent" className="mt-6" asChild>
              <Link href={headerUser ? "/dashboard" : "/"}>
                {headerUser ? "Go to dashboard" : "Back to home"}
              </Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <DocumentWorkspace
      key={`${document.id}:${document.updatedAt}:${headerUser?.id ?? "anon"}`}
      initialDocument={document}
      user={headerUser}
      shareToken={token}
    />
  );
}

export default function SharedDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<DocumentLoading />}>
      <SharedDocumentContent params={params} />
    </Suspense>
  );
}
