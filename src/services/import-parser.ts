import { extractPlainTextFromTiptap } from "@/lib/utils";
import type { DocumentSourceType } from "@/types/database";
import type { TiptapDocument, TiptapMark, TiptapNode } from "@/types/tiptap";

export interface ParsedImportResult {
  title: string;
  content: TiptapDocument;
  contentText: string;
  sourceType: Exclude<DocumentSourceType, "blank">;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.(txt|md|markdown)$/i, "").trim() || "Imported Document";
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim().toLowerCase();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:")
  );
}

export function parseInlineMarkdown(text: string): TiptapNode[] {
  if (!text) return [];

  const nodes: TiptapNode[] = [];
  const tokenRegex =
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|\[([^\]]+)\]\(([^)\s]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({
        type: "text",
        text: text.slice(lastIndex, match.index),
      });
    }

    const token = match[0];

    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push({
        type: "text",
        text: token.slice(1, -1),
        marks: [{ type: "code" }],
      });
    } else if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push({
        type: "text",
        text: token.slice(2, -2),
        marks: [{ type: "bold" }],
      });
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push({
        type: "text",
        text: token.slice(2, -2),
        marks: [{ type: "strike" }],
      });
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      nodes.push({
        type: "text",
        text: token.slice(1, -1),
        marks: [{ type: "italic" }],
      });
    } else if (token.startsWith("[")) {
      const label = match[2] ?? token;
      const href = match[3] ?? "";
      const marks: TiptapMark[] = isSafeHref(href)
        ? [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }]
        : [];
      nodes.push({
        type: "text",
        text: label,
        ...(marks.length > 0 ? { marks } : {}),
      });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push({
      type: "text",
      text: text.slice(lastIndex),
    });
  }

  return nodes;
}

export function parsePlainTextToTiptap(rawText: string): TiptapDocument {
  const normalized = rawText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  const blocks = normalized.split(/\n{2,}/);
  const content: TiptapNode[] = blocks.map((block) => {
    const lines = block.split("\n");
    const inlineContent: TiptapNode[] = [];
    lines.forEach((line, idx) => {
      if (line.length > 0) {
        inlineContent.push({ type: "text", text: line });
      }
      if (idx < lines.length - 1) {
        inlineContent.push({ type: "hardBreak" });
      }
    });

    return inlineContent.length > 0
      ? { type: "paragraph", content: inlineContent }
      : { type: "paragraph" };
  });

  return { type: "doc", content };
}

export function parseMarkdownToTiptap(rawMarkdown: string): {
  document: TiptapDocument;
  extractedTitle: string | null;
} {
  const normalized = rawMarkdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const content: TiptapNode[] = [];
  let extractedTitle: string | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = trimmed.match(/^```([\w-]*)\s*$/);
    if (fenceMatch) {
      const language = fenceMatch[1] || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      const codeText = codeLines.join("\n");
      content.push({
        type: "codeBlock",
        ...(language ? { attrs: { language } } : {}),
        ...(codeText ? { content: [{ type: "text", text: codeText }] } : {}),
      });
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Heading (# .. ######)
    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      if (level === 1 && !extractedTitle && headingText) {
        extractedTitle = headingText;
      }
      const inline = parseInlineMarkdown(headingText);
      content.push({
        type: "heading",
        attrs: { level },
        ...(inline.length > 0 ? { content: inline } : {}),
      });
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const quoteParagraphs: TiptapNode[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        const stripped = lines[i].replace(/^\s*>\s?/, "").trim();
        if (stripped) {
          const inline = parseInlineMarkdown(stripped);
          quoteParagraphs.push({
            type: "paragraph",
            ...(inline.length > 0 ? { content: inline } : {}),
          });
        }
        i++;
      }
      content.push({
        type: "blockquote",
        content: quoteParagraphs.length > 0 ? quoteParagraphs : [{ type: "paragraph" }],
      });
      continue;
    }

    // Task list (- [ ] or - [x])
    if (/^\s*[-*+]\s+\[([ xX])\]\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length) {
        const taskMatch = lines[i].match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
        if (!taskMatch) break;
        const checked = taskMatch[1].toLowerCase() === "x";
        const inline = parseInlineMarkdown(taskMatch[2].trim());
        items.push({
          type: "taskItem",
          attrs: { checked },
          content: [
            {
              type: "paragraph",
              ...(inline.length > 0 ? { content: inline } : {}),
            },
          ],
        });
        i++;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }

    // Bullet list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length) {
        const bulletMatch = lines[i].match(/^\s*[-*+]\s+(.*)$/);
        if (!bulletMatch || /^\s*[-*+]\s+\[([ xX])\]\s+/.test(lines[i])) break;
        const inline = parseInlineMarkdown(bulletMatch[1].trim());
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              ...(inline.length > 0 ? { content: inline } : {}),
            },
          ],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length) {
        const ordMatch = lines[i].match(/^\s*\d+\.\s+(.*)$/);
        if (!ordMatch) break;
        const inline = parseInlineMarkdown(ordMatch[1].trim());
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              ...(inline.length > 0 ? { content: inline } : {}),
            },
          ],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // Paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i].trim()) &&
      !/^(---|\*\*\*|___)\s*$/.test(lines[i].trim()) &&
      !/^\s{0,3}#{1,6}\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    const inline = parseInlineMarkdown(paraLines.join(" "));
    content.push({
      type: "paragraph",
      ...(inline.length > 0 ? { content: inline } : {}),
    });
  }

  return {
    document: {
      type: "doc",
      content: content.length > 0 ? content : [{ type: "paragraph" }],
    },
    extractedTitle,
  };
}

export function parseImportedFile(params: {
  filename: string;
  rawContent: string;
  customTitle?: string;
}): ParsedImportResult {
  const { filename, rawContent, customTitle } = params;
  const lower = filename.toLowerCase();
  const isMarkdown = lower.endsWith(".md") || lower.endsWith(".markdown");
  const fallbackTitle = stripExtension(filename);

  if (isMarkdown) {
    const { document, extractedTitle } = parseMarkdownToTiptap(rawContent);
    const title = (customTitle?.trim() || extractedTitle || fallbackTitle).slice(0, 200);
    return {
      title,
      content: document,
      contentText: extractPlainTextFromTiptap(document),
      sourceType: "markdown",
    };
  }

  const document = parsePlainTextToTiptap(rawContent);
  const title = (customTitle?.trim() || fallbackTitle).slice(0, 200);
  return {
    title,
    content: document,
    contentText: extractPlainTextFromTiptap(document),
    sourceType: "txt",
  };
}

