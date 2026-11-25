import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  FileUp,
  Lock,
  Share2,
  Sparkles,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getOptionalUser() {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return null;

    return {
      id: authUser.id,
      email: authUser.email ?? "",
      fullName:
        (authUser.user_metadata?.full_name as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

async function HomeHeader() {
  const user = await getOptionalUser();
  return <AppHeader user={user} />;
}

async function HomeCta() {
  const user = await getOptionalUser();

  if (user) {
    return (
      <Button variant="accent" size="lg" asChild>
        <Link href="/dashboard">
          Open Dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button variant="accent" size="lg" asChild>
        <Link href="/signup">
          Start writing free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="outline" size="lg" asChild>
        <Link href="/login">Sign in</Link>
      </Button>
    </>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Suspense fallback={<AppHeader user={null} />}>
        <HomeHeader />
      </Suspense>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="indigo" className="mb-5 gap-1.5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Ajaia Docs SaaS Workspace
            </Badge>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Write, import, and share documents with{" "}
              <span className="text-indigo-600">zero friction.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Ajaia Docs combines a distraction-free Tiptap rich text editor,
              instant TXT &amp; Markdown imports, granular collaborator
              permissions, and PostgreSQL row-level security powered by
              Supabase.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Suspense
                fallback={
                  <Button variant="accent" size="lg" asChild>
                    <Link href="/signup">
                      Start writing free
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                }
              >
                <HomeCta />
              </Suspense>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground">Rich Tiptap Editor</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Headings, task lists, code blocks, highlights, and debounced
                autosave persisted directly in PostgreSQL.
              </p>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <FileUp className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground">TXT &amp; MD Import</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Upload <code className="font-mono">.txt</code> or{" "}
                <code className="font-mono">.md</code> files and parse headings,
                lists, links, and code into structured documents.
              </p>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Share2 className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground">Flexible Sharing</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Invite collaborators by email with Viewer or Editor roles, or
                toggle rotatable public share links.
              </p>
            </Card>

            <Card className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground">Server Authorization</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Zod-validated API routes paired with server-side capability
                checks and Supabase Row Level Security.
              </p>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card py-6 text-center text-xs text-muted-foreground">
        Ajaia Docs &mdash; Built with Next.js App Router, Tiptap, Tailwind CSS, and Supabase.
      </footer>
    </div>
  );
}
