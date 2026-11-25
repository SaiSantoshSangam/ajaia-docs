"use client";

import Link from "next/link";
import {
  Clock,
  ExternalLink,
  FileText,
  Globe,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeDate } from "@/lib/utils";
import type { DocumentSummary } from "@/types/document";

interface DocumentCardProps {
  document: DocumentSummary;
  onDeleteRequest: (doc: DocumentSummary) => void;
  onShareRequest: (doc: DocumentSummary) => void;
  onRenameRequest: (doc: DocumentSummary) => void;
}

const ROLE_BADGE_VARIANT = {
  owner: "indigo",
  editor: "emerald",
  viewer: "secondary",
} as const;

export function DocumentCard({
  document,
  onDeleteRequest,
  onShareRequest,
  onRenameRequest,
}: DocumentCardProps) {
  const preview =
    document.contentText.trim().slice(0, 140) ||
    "Empty document — open to start writing.";

  const ownerDisplay =
    document.role === "owner"
      ? "You"
      : document.ownerName || document.ownerEmail || "Collaborator";

  const ownerInitials = ownerDisplay
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const canRename = document.role === "owner" || document.role === "editor";
  const isOwner = document.role === "owner";

  return (
    <Card className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 transition-all hover:border-indigo-300 hover:bg-slate-50/40 hover:shadow-md">
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <Link
            href={`/docs/${document.id}`}
            className="flex min-w-0 flex-1 items-start gap-3"
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-tight text-foreground group-hover:text-indigo-600">
                {document.title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={ROLE_BADGE_VARIANT[document.role]}
                  className="px-2 py-0 text-[11px] capitalize"
                >
                  {document.role === "owner"
                    ? "Owner"
                    : document.role === "editor"
                      ? "Shared · Editor"
                      : "Shared · Viewer"}
                </Badge>
                {document.sourceType !== "blank" && (
                  <Badge variant="outline" className="px-2 py-0 text-[11px] uppercase">
                    {document.sourceType}
                  </Badge>
                )}
                {document.isPublic && (
                  <Badge variant="amber" className="gap-1 px-2 py-0 text-[11px]">
                    <Globe className="h-2.5 w-2.5" />
                    Public
                  </Badge>
                )}
              </div>
            </div>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Actions for ${document.title}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/docs/${document.id}`}>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  Open document
                </Link>
              </DropdownMenuItem>
              {canRename && (
                <DropdownMenuItem onClick={() => onRenameRequest(document)}>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  Rename
                </DropdownMenuItem>
              )}
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={() => onShareRequest(document)}>
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                    Share settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteRequest(document)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link href={`/docs/${document.id}`} className="block">
          <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-slate-600">
            {preview}
          </p>
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
            {ownerInitials}
          </span>
          <span className="truncate">
            Owner:{" "}
            <span className="font-medium text-slate-700">{ownerDisplay}</span>
          </span>
        </div>

        <span
          className="inline-flex shrink-0 items-center gap-1"
          title={new Date(document.updatedAt).toLocaleString()}
        >
          <Clock className="h-3 w-3" />
          {formatRelativeDate(document.updatedAt)}
        </span>
      </div>
    </Card>
  );
}
