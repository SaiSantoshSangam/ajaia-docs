"use client";

import { useRef, useState } from "react";
import { FileUp, FileText, Loader2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  isAllowedImportFilename,
  MAX_IMPORT_FILE_BYTES,
  validateTextContent,
} from "@/lib/validations/import";
import type { DocumentDetail } from "@/types/document";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (doc: DocumentDetail) => void;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(file: File | null) {
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isAllowedImportFilename(file.name)) {
      const msg = "Please select a .txt, .md, or .markdown file.";
      setError(msg);
      toast.error(msg);
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      const msg = "The selected file is empty.";
      setError(msg);
      toast.error(msg);
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      const msg = "File exceeds the 2 MB maximum size limit.";
      setError(msg);
      toast.error(msg);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      const msg = "Please choose a .txt or .md file to import.";
      setError(msg);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const rawText = await selectedFile.text();
      const contentValidationError = validateTextContent(rawText);
      if (contentValidationError) {
        setError(contentValidationError);
        toast.error(contentValidationError);
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      if (customTitle.trim()) {
        formData.append("title", customTitle.trim());
      }

      const response = await fetch("/api/documents/import", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg =
          payload.error || `Import failed (HTTP ${response.status})`;
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success(`Imported "${payload.document.title}"`);
      setSelectedFile(null);
      setCustomTitle("");
      onOpenChange(false);
      onImported(payload.document);
    } catch {
      const msg = "Network error while importing file. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import TXT or Markdown</DialogTitle>
          <DialogDescription>
            Convert a <code className="font-mono">.txt</code> or{" "}
            <code className="font-mono">.md</code> file into an editable Ajaia document.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            data-testid="import-dropzone"
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileChange(e.dataTransfer.files[0] ?? null);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              isDragging
                ? "border-indigo-500 bg-indigo-50/70"
                : "border-border bg-secondary/40 hover:border-indigo-400 hover:bg-indigo-50/40"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              aria-label="Choose file to import"
            />
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
              <FileUp className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Click to browse or drag &amp; drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports .txt, .md, and .markdown up to 2 MB
            </p>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                <span className="truncate font-medium">{selectedFile.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                aria-label="Clear selected file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="import-title">Document title (optional)</Label>
            <Input
              id="import-title"
              placeholder="Auto-detected from H1 heading or filename"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent"
              disabled={!selectedFile || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Import document
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
