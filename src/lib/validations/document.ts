import { z } from "zod";
import type { TiptapDocument } from "@/types/tiptap";

const tiptapMarkSchema = z
  .object({
    type: z.string().min(1),
    attrs: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const tiptapNodeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(tiptapNodeSchema).optional(),
      marks: z.array(tiptapMarkSchema).optional(),
      text: z.string().optional(),
    })
    .strict()
);

export const tiptapDocumentSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(tiptapNodeSchema).default([]),
  })
  .strict() as unknown as z.ZodType<TiptapDocument>;

export const documentScopeSchema = z.enum(["all", "owned", "shared"]);

export const listDocumentsQuerySchema = z.object({
  scope: documentScopeSchema.default("all"),
});

export const createDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title must be 200 characters or fewer")
      .default("Untitled Document"),
    content: tiptapDocumentSchema.optional(),
    sourceType: z.enum(["blank", "markdown", "txt"]).default("blank"),
  })
  .strict();

export const updateDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title must be 200 characters or fewer")
      .optional(),
    content: tiptapDocumentSchema.optional(),
  })
  .strict()
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: "At least one of title or content must be provided",
  });

export const renameDocumentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title cannot be empty")
      .max(200, "Title must be 200 characters or fewer"),
  })
  .strict();

export const uuidParamSchema = z.string().uuid("Invalid identifier format");
