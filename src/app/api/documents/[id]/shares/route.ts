import { handleApiError, jsonError, jsonOk } from "@/lib/api-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidParamSchema } from "@/lib/validations/document";
import {
  createShareSchema,
  updatePublicAccessSchema,
} from "@/lib/validations/share";
import {
  addOrUpdateCollaborator,
  getShareSettings,
  updatePublicAccess,
} from "@/services/shares.service";

export async function GET(
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

    const settings = await getShareSettings(
      supabase,
      { id: user.id, email: user.email },
      documentId
    );

    return jsonOk(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
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

    const body = await request.json();
    const parsed = createShareSchema.parse(body);

    const collaborator = await addOrUpdateCollaborator(
      supabase,
      { id: user.id, email: user.email },
      documentId,
      parsed
    );

    return jsonOk({ collaborator }, 201);
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

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("Authentication required", 401);
    }

    const body = await request.json();
    const parsed = updatePublicAccessSchema.parse(body);

    const publicAccess = await updatePublicAccess(
      supabase,
      { id: user.id, email: user.email },
      documentId,
      parsed
    );

    return jsonOk(publicAccess);
  } catch (error) {
    return handleApiError(error);
  }
}

