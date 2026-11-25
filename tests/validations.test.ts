import { describe, expect, it } from "vitest";
import {
  createDocumentSchema,
  updateDocumentSchema,
  uuidParamSchema,
} from "@/lib/validations/document";
import {
  importDocumentSchema,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/validations/import";
import {
  createShareSchema,
  updatePublicAccessSchema,
} from "@/lib/validations/share";

describe("zod validation schemas", () => {
  it("validates document create and update payloads", () => {
    const created = createDocumentSchema.parse({});
    expect(created.title).toBe("Untitled Document");
    expect(created.sourceType).toBe("blank");

    expect(() => updateDocumentSchema.parse({})).toThrow();
    expect(
      updateDocumentSchema.parse({ title: "  Roadmap  " }).title
    ).toBe("Roadmap");

    expect(
      uuidParamSchema.safeParse("11111111-1111-4111-8111-111111111111").success
    ).toBe(true);
    expect(uuidParamSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("validates share invite and public access payloads", () => {
    const share = createShareSchema.parse({
      email: "  USER@Example.com ",
      role: "editor",
    });
    expect(share.email).toBe("user@example.com");
    expect(share.role).toBe("editor");

    expect(() =>
      createShareSchema.parse({ email: "invalid-email", role: "viewer" })
    ).toThrow();

    expect(() => updatePublicAccessSchema.parse({})).toThrow();
    expect(
      updatePublicAccessSchema.parse({ isPublic: true, publicRole: "viewer" })
    ).toEqual({ isPublic: true, publicRole: "viewer" });
  });

  it("validates TXT and Markdown import filenames and content", () => {
    expect(
      importDocumentSchema.safeParse({
        filename: "spec.md",
        rawContent: "# Hello",
      }).success
    ).toBe(true);

    expect(
      importDocumentSchema.safeParse({
        filename: "notes.txt",
        rawContent: "Plain text",
      }).success
    ).toBe(true);

    expect(
      importDocumentSchema.safeParse({
        filename: "malware.exe",
        rawContent: "binary",
      }).success
    ).toBe(false);

    expect(
      importDocumentSchema.safeParse({
        filename: "empty.md",
        rawContent: "",
      }).success
    ).toBe(false);

    expect(
      importDocumentSchema.safeParse({
        filename: "whitespace.txt",
        rawContent: "   \n\t  ",
      }).success
    ).toBe(false);

    expect(
      importDocumentSchema.safeParse({
        filename: "binary.txt",
        rawContent: "abc\u0000def",
      }).success
    ).toBe(false);

    expect(MAX_IMPORT_FILE_BYTES).toBe(2 * 1024 * 1024);
    expect(
      importDocumentSchema.safeParse({
        filename: "huge.txt",
        rawContent: "a".repeat(MAX_IMPORT_FILE_BYTES + 1),
      }).success
    ).toBe(false);
  });
});

