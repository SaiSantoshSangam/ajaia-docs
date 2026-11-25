import { handleApiError, jsonError, jsonOk } from "@/lib/api-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  importDocumentSchema,
  isAllowedImportFilename,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/validations/import";
import { createDocument } from "@/services/documents.service";
import { parseImportedFile } from "@/services/import-parser";

function isFormFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as File).name === "string" &&
    "size" in value &&
    typeof (value as File).size === "number" &&
    "text" in value &&
    typeof (value as File).text === "function"
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Authentication required", 401);
    }

    const contentType = request.headers.get("content-type") ?? "";
    let filename = "";
    let rawContent = "";
    let customTitle: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const titleField = formData.get("title");

      if (!isFormFile(file)) {
        return jsonError("A .txt or .md file is required", 400);
      }

      if (!isAllowedImportFilename(file.name)) {
        return jsonError(
          "Unsupported file format. Only .txt, .md, and .markdown files are supported.",
          400
        );
      }

      if (file.size === 0) {
        return jsonError("Imported file cannot be empty", 400);
      }

      if (file.size > MAX_IMPORT_FILE_BYTES) {
        return jsonError("File size exceeds the 2 MB maximum limit", 400);
      }

      filename = file.name;
      rawContent = await file.text();
      if (typeof titleField === "string" && titleField.trim().length > 0) {
        customTitle = titleField.trim();
      }
    } else {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return jsonError("Invalid JSON request body", 400);
      }
      filename = typeof body?.filename === "string" ? body.filename : "";
      rawContent = typeof body?.rawContent === "string" ? body.rawContent : "";
      customTitle = typeof body?.title === "string" ? body.title : undefined;
    }

    const validated = importDocumentSchema.parse({
      filename,
      rawContent,
      title: customTitle,
    });

    const parsed = parseImportedFile({
      filename: validated.filename,
      rawContent: validated.rawContent,
      customTitle: validated.title,
    });

    const document = await createDocument(
      supabase,
      { id: user.id, email: user.email },
      {
        title: parsed.title,
        content: parsed.content,
        sourceType: parsed.sourceType,
      }
    );

    return jsonOk({ document }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
