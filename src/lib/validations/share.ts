import { z } from "zod";

export const shareRoleSchema = z.enum(["viewer", "editor"]);

export const createShareSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address")
      .max(255),
    role: shareRoleSchema.default("viewer"),
  })
  .strict();

export const updateShareRoleSchema = z
  .object({
    role: shareRoleSchema,
  })
  .strict();

export const updatePublicAccessSchema = z
  .object({
    isPublic: z.boolean().optional(),
    publicRole: shareRoleSchema.optional(),
    regenerateToken: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.isPublic !== undefined ||
      data.publicRole !== undefined ||
      data.regenerateToken === true,
    {
      message: "At least one sharing setting must be provided",
    }
  );
