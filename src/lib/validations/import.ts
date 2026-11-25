import { z } from "zod";

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_IMPORT_EXTENSIONS = [".txt", ".md", ".markdown"] as const;

export function isAllowedImportFilename(filename: string): boolean {
  const lower = filename.trim().toLowerCase();
  return ALLOWED_IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateTextContent(rawContent: string): string | null {
  const cleaned = rawContent.replace(/^\uFEFF/, "");
  if (cleaned.includes("\u0000")) {
    return "File appears to contain binary data rather than valid plain text or Markdown";
  }
  if (cleaned.trim().length === 0) {
    return "Imported file cannot be empty";
  }
  return null;
}

export const importDocumentSchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1, "Filename is required")
      .max(255)
      .refine(isAllowedImportFilename, {
        message: "Only .txt, .md, and .markdown files are supported",
      }),
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title must be 200 characters or fewer")
      .optional(),
    rawContent: z
      .string()
      .min(1, "Imported file cannot be empty")
      .max(MAX_IMPORT_FILE_BYTES, "File content exceeds the 2 MB limit")
      .superRefine((val, ctx) => {
        const contentError = validateTextContent(val);
        if (contentError) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: contentError,
          });
        }
      }),
  })
  .strict();

export type ImportDocumentInput = z.infer<typeof importDocumentSchema>;
