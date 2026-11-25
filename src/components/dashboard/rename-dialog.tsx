"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentSummary } from "@/types/document";

interface RenameDialogProps {
  document: DocumentSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: (updated: DocumentSummary) => void;
}

export function RenameDialog({
  document,
  open,
  onOpenChange,
  onRenamed,
}: RenameDialogProps) {
  const [title, setTitle] = useState(document?.title ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!document) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setError("Document title cannot be empty.");
      return;
    }

    if (trimmed.length > 200) {
      setError("Title must be 200 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload.error || "Failed to rename document");
        return;
      }

      toast.success(`Renamed to "${payload.document.title}"`);
      onRenamed(payload.document);
      onOpenChange(false);
    } catch {
      setError("Network error while renaming document.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename document</DialogTitle>
          <DialogDescription>
            Enter a new title for this document.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rename-doc-title">Document title</Label>
            <Input
              id="rename-doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
              maxLength={200}
              autoFocus
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save name
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
