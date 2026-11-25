import { handleApiError, jsonError, jsonOk } from "@/lib/api-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createDocumentSchema,
  listDocumentsQuerySchema,
} from "@/lib/validations/document";
import { createDocument, listUserDocuments } from "@/services/documents.service";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Authentication required", 401);
    }

    const url = new URL(request.url);
    const { scope } = listDocumentsQuerySchema.parse({
      scope: url.searchParams.get("scope") ?? undefined,
    });

    const documents = await listUserDocuments(
      supabase,
      { id: user.id, email: user.email },
      scope
    );

    return jsonOk({ documents, scope });
  } catch (error) {
    return handleApiError(error);
  }
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

    const body = await request.json();
    const parsed = createDocumentSchema.parse(body);

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
