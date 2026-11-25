import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  assertDocumentAction,
  getCapabilities,
  resolveDocumentRole,
  type AuthorizableDocument,
} from "@/services/authorization";

const baseDoc: AuthorizableDocument = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "user-owner",
  is_public: false,
  public_role: "viewer",
  share_token: "22222222-2222-4222-8222-222222222222",
};

describe("authorization policy", () => {
  it("grants owner full capabilities regardless of shares", () => {
    const role = resolveDocumentRole({
      user: { id: "user-owner", email: "owner@ajaia.ai" },
      document: baseDoc,
    });

    expect(role).toBe("owner");
    expect(getCapabilities(role)).toEqual({
      canRead: true,
      canEdit: true,
      canShare: true,
      canDelete: true,
    });
  });

  it("matches collaborator share by userId or case-insensitive email", () => {
    const editorRole = resolveDocumentRole({
      user: { id: "user-2", email: "Editor@Ajaia.AI" },
      document: baseDoc,
      shares: [
        {
          shared_with_user_id: null,
          shared_with_email: "editor@ajaia.ai",
          role: "editor",
        },
      ],
    });

    expect(editorRole).toBe("editor");
    expect(getCapabilities(editorRole)).toEqual({
      canRead: true,
      canEdit: true,
      canShare: false,
      canDelete: false,
    });

    const viewerRole = resolveDocumentRole({
      user: { id: "user-3", email: "other@ajaia.ai" },
      document: baseDoc,
      shares: [
        {
          shared_with_user_id: "user-3",
          shared_with_email: "viewer@ajaia.ai",
          role: "viewer",
        },
      ],
    });

    expect(viewerRole).toBe("viewer");
    expect(getCapabilities(viewerRole)).toEqual({
      canRead: true,
      canEdit: false,
      canShare: false,
      canDelete: false,
    });
  });

  it("handles public link access and caps unauthenticated visitors to viewer", () => {
    const publicEditorDoc: AuthorizableDocument = {
      ...baseDoc,
      is_public: true,
      public_role: "editor",
    };

    const anonRole = resolveDocumentRole({
      user: null,
      document: publicEditorDoc,
      shareToken: baseDoc.share_token,
    });
    expect(anonRole).toBe("viewer");

    const signedInRole = resolveDocumentRole({
      user: { id: "user-guest", email: "guest@ajaia.ai" },
      document: publicEditorDoc,
      shareToken: baseDoc.share_token,
    });
    expect(signedInRole).toBe("editor");

    const wrongTokenRole = resolveDocumentRole({
      user: { id: "user-guest", email: "guest@ajaia.ai" },
      document: publicEditorDoc,
      shareToken: "99999999-9999-4999-8999-999999999999",
    });
    expect(wrongTokenRole).toBeNull();
  });

  it("throws 401 for unauthenticated access and 403 for insufficient permissions", () => {
    expect(() => assertDocumentAction(null, "read", false)).toThrowError(
      AuthorizationError
    );
    try {
      assertDocumentAction(null, "read", false);
    } catch (err) {
      expect((err as AuthorizationError).status).toBe(401);
    }

    try {
      assertDocumentAction("viewer", "edit", true);
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError);
      expect((err as AuthorizationError).status).toBe(403);
    }

    try {
      assertDocumentAction("editor", "share", true);
    } catch (err) {
      expect((err as AuthorizationError).status).toBe(403);
    }

    try {
      assertDocumentAction("editor", "delete", true);
    } catch (err) {
      expect((err as AuthorizationError).status).toBe(403);
    }
  });
});

