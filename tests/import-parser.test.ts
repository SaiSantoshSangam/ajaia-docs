import { describe, expect, it } from "vitest";
import {
  parseImportedFile,
  parseInlineMarkdown,
  parseMarkdownToTiptap,
  parsePlainTextToTiptap,
} from "@/services/import-parser";

describe("import-parser", () => {
  it("parses plain text paragraphs and preserves single line breaks", () => {
    const doc = parsePlainTextToTiptap(
      "\uFEFFFirst line\nSecond line\n\nSecond paragraph"
    );

    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "First line" },
        { type: "hardBreak" },
        { type: "text", text: "Second line" },
      ],
    });
    expect(doc.content[1]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Second paragraph" }],
    });
  });

  it("parses markdown headings, lists, tasks, quotes, and fenced code blocks", () => {
    const md = [
      "# Project Spec",
      "",
      "Intro with **bold**, *italic*, ~~old~~, `code`, and [Docs](https://ajaia.ai).",
      "",
      "- Item A",
      "- Item B",
      "",
      "1. First",
      "2. Second",
      "",
      "- [ ] Todo",
      "- [x] Done",
      "",
      "> Important note",
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
      "---",
    ].join("\n");

    const { document, extractedTitle } = parseMarkdownToTiptap(md);
    expect(extractedTitle).toBe("Project Spec");

    const nodeTypes = document.content.map((node) => node.type);
    expect(nodeTypes).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "orderedList",
      "taskList",
      "blockquote",
      "codeBlock",
      "horizontalRule",
    ]);

    expect(document.content[4].content?.[0].attrs).toEqual({ checked: false });
    expect(document.content[4].content?.[1].attrs).toEqual({ checked: true });
    expect(document.content[6].attrs).toEqual({ language: "ts" });
  });

  it("strips unsafe javascript: links from inline markdown", () => {
    const nodes = parseInlineMarkdown("Click [here](javascript:alert(1)) safely");
    const linkNode = nodes.find((n) => n.text === "here");
    expect(linkNode).toBeDefined();
    expect(linkNode?.marks).toBeUndefined();
  });

  it("resolves imported title from customTitle, H1 heading, or filename", () => {
    const fromHeading = parseImportedFile({
      filename: "notes.md",
      rawContent: "# Architecture Guide\n\nBody text",
    });
    expect(fromHeading.title).toBe("Architecture Guide");
    expect(fromHeading.sourceType).toBe("markdown");
    expect(fromHeading.contentText).toContain("Body text");

    const fromCustom = parseImportedFile({
      filename: "meeting-notes.txt",
      rawContent: "Action items for Q4",
      customTitle: "Q4 Kickoff",
    });
    expect(fromCustom.title).toBe("Q4 Kickoff");
    expect(fromCustom.sourceType).toBe("txt");

    const fromFilename = parseImportedFile({
      filename: "release-notes.txt",
      rawContent: "Version 1.0 shipped",
    });
    expect(fromFilename.title).toBe("release-notes");
  });
});

