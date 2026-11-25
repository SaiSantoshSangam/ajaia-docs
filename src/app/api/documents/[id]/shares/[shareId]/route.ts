import { handleApiError, jsonError, jsonOk } from "@/lib/api-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidParamSchema } from "@/lib/validations/document";
import { updateShareRoleSchema } from "@/lib/validations/share";
import {
  revokeCollaborator,
  updateCollaboratorRole,
} from "@/services/shares.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; shareId: string }> }
) {
  try {
    const { id, shareId } = await context.params;
    const documentId = uuidParamSchema.parse(id);
    const validShareId = uuidParamSchema.parse(shareId);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Authentication required", 401);
    }

    const body = await request.json();
    const parsed = updateShareRoleSchema.parse(body);

    const collaborator = await updateCollaboratorRole(
      supabase,
      { id: user.id, email: user.email },
      documentId,
      validShareId,
      parsed.role
    );

    return jsonOk({ collaborator });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; shareId: string }> }
) {
  try {
    const { id, shareId } = await context.params;
    const documentId = uuidParamSchema.parse(id);
    const validShareId = uuidParamSchema.parse(shareId);

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Authentication required", 401);
    }

    await revokeCollaborator(
      supabase,
      { id: user.id, email: user.email },
      documentId,
      validShareId
    );

    return jsonOk({ revoked: true });
  } catch (error) {
    return handleApiError(error);
  }
}

