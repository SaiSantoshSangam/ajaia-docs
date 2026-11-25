import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { TiptapDocument, TiptapNode } from "@/types/tiptap";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractPlainTextFromTiptap(doc: TiptapDocument | TiptapNode | null | undefined): string {
  if (!doc) return "";

  const parts: string[] = [];

  function walk(node: TiptapNode) {
    if (typeof node.text === "string") {
      parts.push(node.text);
      return;
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
      if (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "listItem" ||
        node.type === "taskItem" ||
        node.type === "blockquote" ||
        node.type === "codeBlock"
      ) {
        parts.push("\n");
      }
    }
  }

  walk(doc);

  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

