import type { TiptapDocument } from "./tiptap";

export type ShareRole = "viewer" | "editor";
export type DocumentRole = "owner" | ShareRole;
export type DocumentSourceType = "blank" | "markdown" | "txt";

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  owner_id: string;
  title: string;
  content: TiptapDocument;
  content_text: string;
  is_public: boolean;
  public_role: ShareRole;
  share_token: string;
  source_type: DocumentSourceType;
  created_at: string;
  updated_at: string;
}

export interface DocumentShareRow {
  id: string;
  document_id: string;
  shared_with_user_id: string | null;
  shared_with_email: string;
  role: ShareRole;
  created_by: string;
  created_at: string;
  updated_at: string;
}
