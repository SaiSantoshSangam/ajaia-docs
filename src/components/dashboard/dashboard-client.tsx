"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  FilePlus2,
  FileText,
  FileUp,
  Loader2,
  Menu,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DashboardSidebar,
  type DashboardSection,
} from "@/components/dashboard/dashboard-sidebar";
import { DocumentCard } from "@/components/dashboard/document-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ImportDialog } from "@/components/dashboard/import-dialog";
import { RenameDialog } from "@/components/dashboard/rename-dialog";
import { ShareDialog } from "@/components/editor/share-dialog";
import type { HeaderUser } from "@/components/layout/app-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DocumentDetail, DocumentSummary } from "@/types/document";

interface DashboardClientProps {
  user: HeaderUser;
  initialDocuments: DocumentSummary[];
}

const SECTION_COPY: Record<
  DashboardSection,
  { heading: string; subtitle: string }
> = {
  recent: {
    heading: "Recent Documents",
    subtitle: "Your most recently updated documents and shared workspaces.",
  },
  owned: {
    heading: "My Documents",
    subtitle: "Documents you created or imported and own.",
  },
  shared: {
    heading: "Shared with Me",
    subtitle: "Documents teammates shared with you for reading or editing.",
  },
};

export function DashboardClient({
  user,
  initialDocuments,
}: DashboardClientProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentSummary[]>(initialDocuments);
  const [section, setSection] = useState<DashboardSection>("recent");
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DocumentSummary | null>(null);
  const [shareTarget, setShareTarget] = useState<DocumentSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const firstName = useMemo(() => {
    const raw = user.fullName?.trim() || user.email.split("@")[0] || "there";
    return raw.split(/\s+/)[0];
  }, [user.fullName, user.email]);

  const counts = useMemo(() => {
    const owned = documents.filter((doc) => doc.role === "owner").length;
    const shared = documents.filter((doc) => doc.role !== "owner").length;
    return { all: documents.length, owned, shared };
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (section === "owned" && doc.role !== "owner") return false;
      if (section === "shared" && doc.role === "owner") return false;
      if (!query) return true;
      return (
        doc.title.toLowerCase().includes(query) ||
        doc.contentText.toLowerCase().includes(query) ||
        (doc.ownerName ?? "").toLowerCase().includes(query) ||
        (doc.ownerEmail ?? "").toLowerCase().includes(query)
      );
    });
  }, [documents, search, section]);

  async function fetchDocumentsFromServer(targetSection: DashboardSection) {
    setLoadingDocs(true);
    setLoadError(null);
    try {
      const scope = targetSection === "recent" ? "all" : targetSection;
      const res = await fetch(`/api/documents?scope=${scope}`, {
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load documents");
      }

      const fetched = payload.documents as DocumentSummary[];
      if (scope === "all") {
        setDocuments(fetched);
      } else {
        setDocuments((prev) => {
          const other =
            scope === "owned"
              ? prev.filter((d) => d.role !== "owner")
              : prev.filter((d) => d.role === "owner");
          return [...fetched, ...other].sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt)
          );
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load documents.";
      setLoadError(message);
    } finally {
      setLoadingDocs(false);
    }
  }

  function handleSelectSection(nextSection: DashboardSection) {
    setSection(nextSection);
    void fetchDocumentsFromServer(nextSection);
  }

  async function handleCreateBlank() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled Document",
          sourceType: "blank",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create document");
        return;
      }

      const created = data.document as DocumentDetail;
      setDocuments((prev) => [created, ...prev]);
      router.push(`/docs/${created.id}`);
    } catch {
      toast.error("Network error while creating document");
    } finally {
      setCreating(false);
    }
  }

  function handleImported(doc: DocumentDetail) {
    setDocuments((prev) => [doc, ...prev]);
    router.push(`/docs/${doc.id}`);
  }

  function handleRenamed(updated: DocumentSummary) {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === updated.id ? { ...doc, ...updated } : doc))
    );
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete document");
        return;
      }

      setDocuments((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast.success(`Deleted "${deleteTarget.title}"`);
      setDeleteTarget(null);
    } catch {
      toast.error("Network error while deleting document");
    } finally {
      setDeleting(false);
    }
  }

  const sectionCopy = SECTION_COPY[section];

  return (
    <div className="flex min-h-screen bg-white text-foreground">
      <DashboardSidebar
        user={user}
        activeSection={section}
        onSelectSection={handleSelectSection}
        counts={counts}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-foreground cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-semibold">
                Ajaia <span className="text-indigo-600">Docs</span>
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={handleCreateBlank}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FilePlus2 className="h-4 w-4" />
            )}
            New
          </Button>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
          {/* Welcome Header & Primary Actions */}
          <div className="mb-8 flex flex-col justify-between gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
                Ajaia Workspace
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {sectionCopy.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(true)}
              >
                <FileUp className="h-4 w-4" />
                Import File
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={handleCreateBlank}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FilePlus2 className="h-4 w-4" />
                )}
                New Document
              </Button>
            </div>
          </div>

          {/* Search & Section Subheader */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">
                {sectionCopy.heading}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {visibleDocuments.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search documents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-50/70 pl-9 pr-8 focus-visible:bg-white"
                  aria-label="Search documents"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search query"
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void fetchDocumentsFromServer(section)}
                disabled={loadingDocs}
                title="Refresh documents"
                aria-label="Refresh documents"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingDocs ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          {/* Error State */}
          {loadError && (
            <div
              role="alert"
              className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loadError}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchDocumentsFromServer(section)}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading, Empty, or Cards Grid */}
          {loadingDocs ? (
            <div
              aria-label="Loading documents"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-50/80 p-5"
                />
              ))}
            </div>
          ) : visibleDocuments.length === 0 ? (
            <EmptyState
              hasSearch={search.trim().length > 0}
              section={section}
              onCreateBlank={handleCreateBlank}
              onOpenImport={() => setImportOpen(true)}
              onClearSearch={() => setSearch("")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDeleteRequest={setDeleteTarget}
                  onShareRequest={setShareTarget}
                  onRenameRequest={setRenameTarget}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />

      <RenameDialog
        key={renameTarget?.id ?? "rename-empty"}
        document={renameTarget}
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        onRenamed={handleRenamed}
      />

      {shareTarget && (
        <ShareDialog
          documentId={shareTarget.id}
          documentTitle={shareTarget.title}
          currentUserEmail={user.email}
          open={Boolean(shareTarget)}
          onOpenChange={(open) => {
            if (!open) setShareTarget(null);
          }}
          onSettingsChanged={(settings) => {
            setDocuments((prev) =>
              prev.map((item) =>
                item.id === shareTarget.id
                  ? {
                      ...item,
                      isPublic: settings.isPublic,
                      publicRole: settings.publicRole,
                      shareToken: settings.shareToken,
                    }
                  : item
              )
            );
          }}
        />
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete document?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes <strong>{deleteTarget?.title}</strong> and
            removes access for all collaborators. This action cannot be undone.
          </AlertDialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete document"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
