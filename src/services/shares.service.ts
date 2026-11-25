import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AuthorizationError,
  assertDocumentAction,
  resolveDocumentRole,
  type AuthUser,
} from "@/services/authorization";
import type { DocumentRow, ShareRole } from "@/types/database";
import type {
  CollaboratorShare,
  ShareSettingsPayload,
  ShareWithUser,
} from "@/types/document";

const SHARE_SELECT = `
  id,
  document_id,
  shared_with_user_id,
  shared_with_email,
  role,
  created_by,
  created_at,
  updated_at,
  recipient:users!document_shares_shared_with_user_id_fkey (
    id,
    email,
    full_name,
    avatar_url
  )
`;

async function assertOwnerForSharing(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string
): Promise<Pick<DocumentRow, "id" | "owner_id" | "is_public" | "public_role" | "share_token">> {
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, owner_id, is_public, public_role, share_token")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load document sharing settings: ${error.message}`);
  }

  if (!doc) {
    throw new AuthorizationError("Document not found", 404);
  }

  const role = resolveDocumentRole({
    user,
    document: doc as Pick<
      DocumentRow,
      "id" | "owner_id" | "is_public" | "public_role" | "share_token"
    >,
  });

  assertDocumentAction(role, "share", true);
  return doc as Pick<
    DocumentRow,
    "id" | "owner_id" | "is_public" | "public_role" | "share_token"
  >;
}

function mapCollaborator(row: ShareWithUser): CollaboratorShare {
  return {
    id: row.id,
    documentId: row.document_id,
    email: row.shared_with_email,
    userId: row.shared_with_user_id,
    fullName: row.recipient?.full_name ?? null,
    role: row.role,
    createdAt: row.created_at,
  };
}

export async function getShareSettings(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string
): Promise<ShareSettingsPayload> {
  const doc = await assertOwnerForSharing(supabase, user, documentId);

  const { data: shareRows, error } = await supabase
    .from("document_shares")
    .select(SHARE_SELECT)
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load collaborators: ${error.message}`);
  }

  const collaborators = ((shareRows ?? []) as unknown as ShareWithUser[]).map(
    mapCollaborator
  );

  return {
    isPublic: doc.is_public,
    publicRole: doc.public_role,
    shareToken: doc.share_token,
    collaborators,
  };
}

export async function addOrUpdateCollaborator(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string,
  input: { email: string; role: ShareRole }
): Promise<CollaboratorShare> {
  await assertOwnerForSharing(supabase, user, documentId);

  const normalizedEmail = input.email.trim().toLowerCase();
  if (user.email && normalizedEmail === user.email.trim().toLowerCase()) {
    throw new Error("You are already the owner of this document");
  }

  const { data: matchingUser } = await supabase
    .from("users")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  const { data: upserted, error } = await supabase
    .from("document_shares")
    .upsert(
      {
        document_id: documentId,
        shared_with_email: normalizedEmail,
        shared_with_user_id: matchingUser?.id ?? null,
        role: input.role,
        created_by: user.id,
      },
      { onConflict: "document_id,shared_with_email" }
    )
    .select(SHARE_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to share document: ${error.message}`);
  }

  return mapCollaborator(upserted as unknown as ShareWithUser);
}

export async function updateCollaboratorRole(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string,
  shareId: string,
  role: ShareRole
): Promise<CollaboratorShare> {
  await assertOwnerForSharing(supabase, user, documentId);

  const { data: updated, error } = await supabase
    .from("document_shares")
    .update({ role })
    .eq("id", shareId)
    .eq("document_id", documentId)
    .select(SHARE_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update collaborator role: ${error.message}`);
  }

  if (!updated) {
    throw new AuthorizationError("Share record not found", 404);
  }

  return mapCollaborator(updated as unknown as ShareWithUser);
}

export async function revokeCollaborator(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string,
  shareId: string
): Promise<void> {
  await assertOwnerForSharing(supabase, user, documentId);

  const { data: deleted, error } = await supabase
    .from("document_shares")
    .delete()
    .eq("id", shareId)
    .eq("document_id", documentId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to revoke collaborator access: ${error.message}`);
  }

  if (!deleted) {
    throw new AuthorizationError("Share record not found", 404);
  }
}

export async function updatePublicAccess(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string,
  input: {
    isPublic?: boolean;
    publicRole?: ShareRole;
    regenerateToken?: boolean;
  }
): Promise<{ isPublic: boolean; publicRole: ShareRole; shareToken: string }> {
  await assertOwnerForSharing(supabase, user, documentId);

  const updates: Record<string, unknown> = {};
  if (input.isPublic !== undefined) updates.is_public = input.isPublic;
  if (input.publicRole !== undefined) updates.public_role = input.publicRole;
  if (input.regenerateToken) updates.share_token = crypto.randomUUID();

  const { data: updated, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", documentId)
    .select("is_public, public_role, share_token")
    .single();

  if (error) {
    throw new Error(`Failed to update public link settings: ${error.message}`);
  }

  return {
    isPublic: updated.is_public,
    publicRole: updated.public_role,
    shareToken: updated.share_token,
  };
}
