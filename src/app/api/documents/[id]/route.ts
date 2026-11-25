import { handleApiError, jsonError, jsonOk } from "@/lib/api-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateDocumentSchema, uuidParamSchema } from "@/lib/validations/document";
import {
  deleteDocument,
  getDocumentForUser,
  updateDocument,
} from "@/services/documents.service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const documentId = uuidParamSchema.parse(id);
    const shareToken = new URL(request.url).searchParams.get("token");

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const document = await getDocumentForUser(
      supabase,
      user ? { id: user.id, email: user.email } : null,
      documentId,
      shareToken
    );

    return jsonOk({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const documentId = uuidParamSchema.parse(id);
    const shareToken = new URL(request.url).searchParams.get("token");

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Authentication required to edit documents", 401);
    }

    const body = await request.json();
    const parsed = updateDocumentSchema.parse(body);

    const document = await updateDocument(
      supabase,
      { id: user.id, email: user.email },
      documentId,
      parsed,
      shareToken
    );

    return jsonOk({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const documentId = uuidParamSchema.parse(id);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Authentication required", 401);
    }

    await deleteDocument(
      supabase,
      { id: user.id, email: user.email },
      documentId
    );

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

