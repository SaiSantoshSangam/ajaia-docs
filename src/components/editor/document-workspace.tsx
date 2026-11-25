"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  RotateCw,
  Save,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentEditor } from "@/components/editor/document-editor";
import { ShareDialog } from "@/components/editor/share-dialog";
import { AppHeader, type HeaderUser } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { extractPlainTextFromTiptap } from "@/lib/utils";
import type { DocumentDetail } from "@/types/document";
import type { TiptapDocument } from "@/types/tiptap";

export const AUTOSAVE_DEBOUNCE_MS = 800;

interface DocumentWorkspaceProps {
  initialDocument: DocumentDetail;
  user: HeaderUser | null;
  shareToken?: string;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

function buildSnapshot(title: string, content: TiptapDocument): string {
  return JSON.stringify({
    title: title.trim() || "Untitled Document",
    content,
  });
}

export function DocumentWorkspace({
  initialDocument,
  user,
  shareToken,
}: DocumentWorkspaceProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialDocument.title);
  const [content, setContent] = useState<TiptapDocument>(initialDocument.content);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [navigatingBack, setNavigatingBack] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const canEdit = initialDocument.capabilities.canEdit;
  const canShare = initialDocument.capabilities.canShare;

  const latestRef = useRef({ title, content });
  const lastSavedSnapshotRef = useRef<string>(
    buildSnapshot(initialDocument.title, initialDocument.content)
  );
  const inFlightSnapshotRef = useRef<string | null>(null);
  const pendingFlushRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildPatchUrl = useCallback(() => {
    const query = shareToken ? `?token=${encodeURIComponent(shareToken)}` : "";
    return `/api/documents/${initialDocument.id}${query}`;
  }, [initialDocument.id, shareToken]);

  const persistChanges = useCallback(
    async (initialTitle: string, initialContent: TiptapDocument): Promise<boolean> => {
      if (!canEdit) return true;

      let nextTitle = initialTitle;
      let nextContent = initialContent;

      while (true) {
        const cleanTitle = nextTitle.trim() || "Untitled Document";
        const targetSnapshot = buildSnapshot(cleanTitle, nextContent);

        // Prevent unnecessary database requests when nothing changed since last save
        if (targetSnapshot === lastSavedSnapshotRef.current) {
          setSaveStatus("saved");
          setSaveError(null);
          return true;
        }

        if (inFlightSnapshotRef.current === targetSnapshot) {
          return true;
        }

        if (inFlightSnapshotRef.current !== null) {
          pendingFlushRef.current = true;
          return true;
        }

        inFlightSnapshotRef.current = targetSnapshot;
        setSaveStatus("saving");
        setSaveError(null);

        try {
          const res = await fetch(buildPatchUrl(), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: cleanTitle,
              content: nextContent,
            }),
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.error || "Failed to save changes");
          }

          lastSavedSnapshotRef.current = targetSnapshot;

          const newestSnapshot = buildSnapshot(
            latestRef.current.title,
            latestRef.current.content
          );
          if (pendingFlushRef.current || newestSnapshot !== targetSnapshot) {
            pendingFlushRef.current = false;
            inFlightSnapshotRef.current = null;
            nextTitle = latestRef.current.title;
            nextContent = latestRef.current.content;
            continue;
          }

          setSaveStatus("saved");
          return true;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to save document";
          setSaveStatus("error");
          setSaveError(message);
          toast.error(message);
          return false;
        } finally {
          inFlightSnapshotRef.current = null;
        }
      }
    },
    [buildPatchUrl, canEdit]
  );

  const scheduleAutosave = useCallback(
    (nextTitle: string, nextContent: TiptapDocument) => {
      if (!canEdit) return;

      const snapshot = buildSnapshot(nextTitle, nextContent);
      if (snapshot === lastSavedSnapshotRef.current) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        setSaveStatus("saved");
        setSaveError(null);
        return;
      }

      setSaveStatus("unsaved");
      setSaveError(null);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void persistChanges(
          latestRef.current.title,
          latestRef.current.content
        );
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [canEdit, persistChanges]
  );

  // Warn before closing or reloading tab with unsaved changes
  useEffect(() => {
    if (!canEdit) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const currentSnapshot = buildSnapshot(
        latestRef.current.title,
        latestRef.current.content
      );
      if (
        currentSnapshot !== lastSavedSnapshotRef.current ||
        inFlightSnapshotRef.current !== null
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [canEdit]);

  // Flush pending changes with keepalive on unmount if navigation bypassed the Back button
  useEffect(() => {
    const latestState = latestRef;
    const savedSnapshotState = lastSavedSnapshotRef;
    const inFlightState = inFlightSnapshotRef;
    const timerState = debounceTimerRef;

    return () => {
      if (timerState.current) {
        clearTimeout(timerState.current);
        timerState.current = null;
      }
      if (!canEdit) return;

      const currentSnapshot = buildSnapshot(
        latestState.current.title,
        latestState.current.content
      );
      if (
        currentSnapshot !== savedSnapshotState.current &&
        inFlightState.current !== currentSnapshot
      ) {
        const cleanTitle = latestState.current.title.trim() || "Untitled Document";
        void fetch(buildPatchUrl(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: cleanTitle,
            content: latestState.current.content,
          }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [buildPatchUrl, canEdit]);

  function handleTitleChange(nextTitle: string) {
    setTitle(nextTitle);
    latestRef.current.title = nextTitle;
    scheduleAutosave(nextTitle, latestRef.current.content);
  }

  function handleContentChange(nextContent: TiptapDocument) {
    setContent(nextContent);
    latestRef.current.content = nextContent;
    scheduleAutosave(latestRef.current.title, nextContent);
  }

  function handleManualSave() {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    void persistChanges(latestRef.current.title, latestRef.current.content);
  }

  async function handleBackToDashboard() {
    if (!canEdit) {
      router.push("/dashboard");
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const currentSnapshot = buildSnapshot(
      latestRef.current.title,
      latestRef.current.content
    );

    if (currentSnapshot !== lastSavedSnapshotRef.current) {
      setNavigatingBack(true);
      const ok = await persistChanges(
        latestRef.current.title,
        latestRef.current.content
      );
      setNavigatingBack(false);

      if (!ok) {
        toast.error(
          "Could not save your latest changes. Retry saving before leaving."
        );
        return;
      }
    }

    router.push("/dashboard");
    router.refresh();
  }

  function handleExportTxt() {
    const text = extractPlainTextFromTiptap(latestRef.current.content);
    const blob = new Blob([`${latestRef.current.title}\n\n${text}`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(latestRef.current.title || "document").replace(/[^a-z0-9_-]+/gi, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const statusIndicator = !canEdit ? (
    <Badge variant="secondary" className="gap-1">
      <Eye className="h-3 w-3" />
      Read-only ({initialDocument.role})
    </Badge>
  ) : saveStatus === "saving" ? (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Saving...
    </span>
  ) : saveStatus === "unsaved" ? (
    <span
      role="status"
      aria-live="polite"
      className="text-xs font-medium text-amber-600"
    >
      Unsaved changes
    </span>
  ) : saveStatus === "error" ? (
    <div role="alert" className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3.5 w-3.5" />
      <span>Save failed</span>
      <button
        type="button"
        onClick={handleManualSave}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold underline hover:bg-red-50 cursor-pointer"
      >
        <RotateCw className="h-3 w-3" />
        Retry
      </button>
    </div>
  ) : (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      Saved
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-50/60">
      <AppHeader
        user={user}
        rightSlot={
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">{statusIndicator}</div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportTxt}
              title="Download as TXT"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export</span>
            </Button>

            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleManualSave}
                disabled={saveStatus === "saving"}
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save</span>
              </Button>
            )}

            {canShare && (
              <Button
                type="button"
                variant="accent"
                size="sm"
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </Button>
            )}
          </div>
        }
      />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {user ? (
            <button
              type="button"
              onClick={() => void handleBackToDashboard()}
              disabled={navigatingBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 cursor-pointer"
            >
              {navigatingBack ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeft className="h-4 w-4" />
              )}
              Back to dashboard
            </button>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              Shared via Ajaia Docs public link
            </span>
          )}

          <div className="flex items-center gap-2">
            <Badge variant="indigo" className="capitalize">
              {initialDocument.role}
            </Badge>
            <div className="sm:hidden">{statusIndicator}</div>
          </div>
        </div>

        {saveStatus === "error" && saveError && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700"
          >
            <span>Unable to save your changes: {saveError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualSave}
            >
              Retry save
            </Button>
          </div>
        )}

        <div className="mb-5">
          {canEdit ? (
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Document"
              aria-label="Document title"
              className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground/60 focus:outline-none sm:text-4xl"
            />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {initialDocument.ownerName || initialDocument.ownerEmail
              ? `Owner: ${initialDocument.ownerName || initialDocument.ownerEmail}`
              : "Ajaia Document"}
          </p>
        </div>

        <DocumentEditor
          initialContent={initialDocument.content}
          editable={canEdit}
          onChange={handleContentChange}
        />
      </main>

      {canShare && (
        <ShareDialog
          documentId={initialDocument.id}
          documentTitle={title}
          currentUserEmail={user?.email}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
    </div>
  );
}
