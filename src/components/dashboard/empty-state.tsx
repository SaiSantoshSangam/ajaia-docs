"use client";

import { FilePlus2, FileUp, FolderOpen, Users } from "lucide-react";
import type { DashboardSection } from "@/components/dashboard/dashboard-sidebar";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  hasSearch: boolean;
  section: DashboardSection;
  onCreateBlank: () => void;
  onOpenImport: () => void;
  onClearSearch: () => void;
}

export function EmptyState({
  hasSearch,
  section,
  onCreateBlank,
  onOpenImport,
  onClearSearch,
}: EmptyStateProps) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-slate-50/70 px-6 py-16 text-center">
        <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">
          No matching documents
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Try a different search keyword or clear your filter.
        </p>
        <Button variant="outline" className="mt-4" onClick={onClearSearch}>
          Clear search
        </Button>
      </div>
    );
  }

  if (section === "shared") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-slate-50/70 px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Users className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          No shared documents yet
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          Documents that teammates share with your email address will appear here
          automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-slate-50/70 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <FilePlus2 className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        Create your first document
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Start from a blank canvas or import an existing TXT or Markdown file to
        organize, edit, and share with your team.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="accent" onClick={onCreateBlank}>
          <FilePlus2 className="h-4 w-4" />
          New Document
        </Button>
        <Button variant="outline" onClick={onOpenImport}>
          <FileUp className="h-4 w-4" />
          Import File
        </Button>
      </div>
    </div>
  );
}
