import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPlainTextFromTiptap } from "@/lib/utils";
import {
  AuthorizationError,
  assertDocumentAction,
  getCapabilities,
  resolveDocumentRole,
  type AuthUser,
} from "@/services/authorization";
import type { DocumentRow, DocumentSourceType } from "@/types/database";
import type {
  DocumentDetail,
  DocumentSummary,
  DocumentWithOwner,
} from "@/types/document";
import { EMPTY_TIPTAP_DOCUMENT, type TiptapDocument } from "@/types/tiptap";

export type DocumentListScope = "all" | "owned" | "shared";

const DOCUMENT_SELECT = `
  id,
  owner_id,
  title,
  content,
  content_text,
  is_public,
  public_role,
  share_token,
  source_type,
  created_at,
  updated_at,
  owner:users!documents_owner_id_fkey (
    id,
    email,
    full_name,
    avatar_url
  )
`;

function mapToSummary(
  row: DocumentWithOwner,
  role: DocumentSummary["role"]
): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    contentText: row.content_text,
    ownerId: row.owner_id,
    ownerName: row.owner?.full_name ?? null,
    ownerEmail: row.owner?.email ?? null,
    isPublic: row.is_public,
    publicRole: row.public_role,
    shareToken: row.share_token,
    sourceType: row.source_type,
    role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapToDetail(
  row: DocumentWithOwner,
  role: DocumentDetail["role"]
): DocumentDetail {
  return {
    ...mapToSummary(row, role),
    content: (row.content as TiptapDocument) ?? EMPTY_TIPTAP_DOCUMENT,
    capabilities: getCapabilities(role),
  };
}

export async function listUserDocuments(
  supabase: SupabaseClient,
  user: AuthUser,
  scope: DocumentListScope = "all"
): Promise<DocumentSummary[]> {
  let query = supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .order("updated_at", { ascending: false });

  if (scope === "owned") {
    query = query.eq("owner_id", user.id);
  } else if (scope === "shared") {
    query = query.neq("owner_id", user.id);
  }

  const { data: docs, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  const rows = (docs ?? []) as unknown as DocumentWithOwner[];
  if (rows.length === 0) return [];

  const nonOwnedIds = rows
    .filter((doc) => doc.owner_id !== user.id)
    .map((doc) => doc.id);

  let sharesByDoc = new Map<
    string,
    Array<{ shared_with_user_id: string | null; shared_with_email: string; role: "viewer" | "editor" }>
  >();

  if (nonOwnedIds.length > 0) {
    const { data: shares, error: sharesError } = await supabase
      .from("document_shares")
      .select("document_id, shared_with_user_id, shared_with_email, role")
      .in("document_id", nonOwnedIds);

    if (sharesError) {
      throw new Error(`Failed to fetch document shares: ${sharesError.message}`);
    }

    sharesByDoc = new Map();
    for (const share of shares ?? []) {
      const list = sharesByDoc.get(share.document_id) ?? [];
      list.push(share);
      sharesByDoc.set(share.document_id, list);
    }
  }

  const results: DocumentSummary[] = [];
  for (const row of rows) {
    const isOwner = row.owner_id === user.id;
    const docShares = sharesByDoc.get(row.id) ?? [];
    const role = resolveDocumentRole({
      user,
      document: row,
      shares: docShares,
    });

    if (role === null) continue;
    if (scope === "owned" && !isOwner) continue;
    if (scope === "shared" && (isOwner || role === "owner" || docShares.length === 0)) {
      continue;
    }
    if (scope === "all" && !isOwner && docShares.length === 0) continue;

    results.push(mapToSummary(row, role));
  }

  return results;
}

export async function listOwnedDocuments(
  supabase: SupabaseClient,
  user: AuthUser
): Promise<DocumentSummary[]> {
  return listUserDocuments(supabase, user, "owned");
}

export async function listSharedDocuments(
  supabase: SupabaseClient,
  user: AuthUser
): Promise<DocumentSummary[]> {
  return listUserDocuments(supabase, user, "shared");
}

export async function getDocumentForUser(
  supabase: SupabaseClient,
  user: AuthUser | null,
  documentId: string,
  shareToken?: string | null
): Promise<DocumentDetail> {
  const { data: row, error } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load document: ${error.message}`);
  }

  if (!row) {
    throw new AuthorizationError("Document not found", 404);
  }

  const doc = row as unknown as DocumentWithOwner;
  let shares: Array<{
    shared_with_user_id: string | null;
    shared_with_email: string;
    role: "viewer" | "editor";
  }> = [];

  if (user && doc.owner_id !== user.id) {
    const { data: shareRows } = await supabase
      .from("document_shares")
      .select("shared_with_user_id, shared_with_email, role")
      .eq("document_id", documentId);
    shares = shareRows ?? [];
  }

  const role = resolveDocumentRole({
    user,
    document: doc,
    shares,
    shareToken,
  });

  assertDocumentAction(role, "read", Boolean(user));
  return mapToDetail(doc, role!);
}

export async function getDocumentByShareToken(
  supabase: SupabaseClient,
  user: AuthUser | null,
  shareToken: string
): Promise<DocumentDetail> {
  const { data: row, error } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("share_token", shareToken)
    .eq("is_public", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load shared document: ${error.message}`);
  }

  if (!row) {
    throw new AuthorizationError("Shared document not found or link is disabled", 404);
  }

  const doc = row as unknown as DocumentWithOwner;
  let shares: Array<{
    shared_with_user_id: string | null;
    shared_with_email: string;
    role: "viewer" | "editor";
  }> = [];

  if (user && doc.owner_id !== user.id) {
    const { data: shareRows } = await supabase
      .from("document_shares")
      .select("shared_with_user_id, shared_with_email, role")
      .eq("document_id", doc.id);
    shares = shareRows ?? [];
  }

  const role = resolveDocumentRole({
    user,
    document: doc,
    shares,
    shareToken,
  });

  assertDocumentAction(role, "read", Boolean(user));
  return mapToDetail(doc, role!);
}

export async function createDocument(
  supabase: SupabaseClient,
  user: AuthUser,
  input: {
    title: string;
    content?: TiptapDocument;
    sourceType?: DocumentSourceType;
  }
): Promise<DocumentDetail> {
  const documentId = crypto.randomUUID();
  const content = input.content ?? EMPTY_TIPTAP_DOCUMENT;
  const contentText = extractPlainTextFromTiptap(content);

  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    owner_id: user.id,
    title: input.title,
    content,
    content_text: contentText,
    source_type: input.sourceType ?? "blank",
  });

  if (insertError) {
    throw new Error(`Failed to create document: ${insertError.message}`);
  }

  const { data: row, error: fetchError } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", documentId)
    .single();

  if (fetchError || !row) {
    throw new Error(
      `Failed to load created document: ${fetchError?.message ?? "Not found"}`
    );
  }

  return mapToDetail(row as unknown as DocumentWithOwner, "owner");
}

export async function updateDocument(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string,
  input: {
    title?: string;
    content?: TiptapDocument;
  },
  shareToken?: string | null
): Promise<DocumentDetail> {
  const { data: existing, error: fetchError } = await supabase
    .from("documents")
    .select("id, owner_id, is_public, public_role, share_token")
    .eq("id", documentId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to verify document access: ${fetchError.message}`);
  }

  if (!existing) {
    throw new AuthorizationError("Document not found", 404);
  }

  let shares: Array<{
    shared_with_user_id: string | null;
    shared_with_email: string;
    role: "viewer" | "editor";
  }> = [];

  if (existing.owner_id !== user.id) {
    const { data: shareRows } = await supabase
      .from("document_shares")
      .select("shared_with_user_id, shared_with_email, role")
      .eq("document_id", documentId);
    shares = shareRows ?? [];
  }

  const role = resolveDocumentRole({
    user,
    document: existing as Pick<
      DocumentRow,
      "id" | "owner_id" | "is_public" | "public_role" | "share_token"
    >,
    shares,
    shareToken,
  });

  assertDocumentAction(role, "edit", true);

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) {
    updates.title = input.title;
  }
  if (input.content !== undefined) {
    updates.content = input.content;
    updates.content_text = extractPlainTextFromTiptap(input.content);
  }

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", documentId)
    .select(DOCUMENT_SELECT)
    .single();

  if (updateError) {
    throw new Error(`Failed to update document: ${updateError.message}`);
  }

  return mapToDetail(updated as unknown as DocumentWithOwner, role!);
}

export async function renameDocument(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string,
  title: string,
  shareToken?: string | null
): Promise<DocumentDetail> {
  return updateDocument(supabase, user, documentId, { title }, shareToken);
}

export async function updateDocumentContent(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string,
  content: TiptapDocument,
  shareToken?: string | null
): Promise<DocumentDetail> {
  return updateDocument(supabase, user, documentId, { content }, shareToken);
}

export async function deleteDocument(
  supabase: SupabaseClient,
  user: AuthUser,
  documentId: string
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from("documents")
    .select("id, owner_id, is_public, public_role, share_token")
    .eq("id", documentId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to verify document ownership: ${fetchError.message}`);
  }

  if (!existing) {
    throw new AuthorizationError("Document not found", 404);
  }

  const role = resolveDocumentRole({
    user,
    document: existing as Pick<
      DocumentRow,
      "id" | "owner_id" | "is_public" | "public_role" | "share_token"
    >,
  });

  assertDocumentAction(role, "delete", true);

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    throw new Error(`Failed to delete document: ${deleteError.message}`);
  }
}
