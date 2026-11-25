import type { DocumentRole, DocumentRow, DocumentShareRow, ShareRole, UserRow } from "./database";
import type { TiptapDocument } from "./tiptap";

export interface DocumentCapabilities {
  canRead: boolean;
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
}

export interface DocumentSummary {
  id: string;
  title: string;
  contentText: string;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  isPublic: boolean;
  publicRole: ShareRole;
  shareToken: string;
  sourceType: DocumentRow["source_type"];
  role: DocumentRole;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: TiptapDocument;
  capabilities: DocumentCapabilities;
}

export interface CollaboratorShare {
  id: string;
  documentId: string;
  email: string;
  userId: string | null;
  fullName: string | null;
  role: ShareRole;
  createdAt: string;
}

export interface ShareSettingsPayload {
  isPublic: boolean;
  publicRole: ShareRole;
  shareToken: string;
  collaborators: CollaboratorShare[];
}

export type DocumentWithOwner = DocumentRow & {
  owner?: Pick<UserRow, "id" | "email" | "full_name" | "avatar_url"> | null;
};

export type ShareWithUser = DocumentShareRow & {
  recipient?: Pick<UserRow, "id" | "email" | "full_name" | "avatar_url"> | null;
};
