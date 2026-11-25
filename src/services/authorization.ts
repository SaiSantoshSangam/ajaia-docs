import type { DocumentRole, ShareRole } from "@/types/database";
import type { DocumentCapabilities } from "@/types/document";

export class AuthorizationError extends Error {
  public readonly status: 401 | 403 | 404;

  constructor(message: string, status: 401 | 403 | 404 = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export interface AuthUser {
  id: string;
  email?: string | null;
}

export interface AuthorizableDocument {
  id: string;
  owner_id: string;
  is_public: boolean;
  public_role: ShareRole;
  share_token: string;
}

export interface AuthorizableShare {
  shared_with_user_id: string | null;
  shared_with_email: string;
  role: ShareRole;
}

const ROLE_WEIGHT: Record<DocumentRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

function higherRole(a: DocumentRole | null, b: DocumentRole | null): DocumentRole | null {
  if (!a) return b;
  if (!b) return a;
  return ROLE_WEIGHT[a] >= ROLE_WEIGHT[b] ? a : b;
}

export function resolveDocumentRole(params: {
  user: AuthUser | null;
  document: AuthorizableDocument;
  shares?: AuthorizableShare[];
  shareToken?: string | null;
}): DocumentRole | null {
  const { user, document, shares = [], shareToken } = params;

  if (user && document.owner_id === user.id) {
    return "owner";
  }

  let resolved: DocumentRole | null = null;

  if (user) {
    const normalizedEmail = user.email?.trim().toLowerCase() ?? null;
    for (const share of shares) {
      const matchesUserId = share.shared_with_user_id !== null && share.shared_with_user_id === user.id;
      const matchesEmail =
        normalizedEmail !== null && share.shared_with_email.trim().toLowerCase() === normalizedEmail;

      if (matchesUserId || matchesEmail) {
        resolved = higherRole(resolved, share.role);
      }
    }
  }

  const hasValidPublicLink =
    document.is_public &&
    Boolean(shareToken) &&
    shareToken === document.share_token;

  if (hasValidPublicLink) {
    // Unauthenticated visitors are always capped to read-only viewer access;
    // signed-in visitors receive the configured public_role (viewer or editor).
    const effectivePublicRole: ShareRole = user ? document.public_role : "viewer";
    resolved = higherRole(resolved, effectivePublicRole);
  }

  return resolved;
}

export function getCapabilities(role: DocumentRole | null): DocumentCapabilities {
  switch (role) {
    case "owner":
      return {
        canRead: true,
        canEdit: true,
        canShare: true,
        canDelete: true,
      };
    case "editor":
      return {
        canRead: true,
        canEdit: true,
        canShare: false,
        canDelete: false,
      };
    case "viewer":
      return {
        canRead: true,
        canEdit: false,
        canShare: false,
        canDelete: false,
      };
    default:
      return {
        canRead: false,
        canEdit: false,
        canShare: false,
        canDelete: false,
      };
  }
}

export function assertDocumentAction(
  role: DocumentRole | null,
  action: "read" | "edit" | "share" | "delete",
  isAuthenticated: boolean
): DocumentCapabilities {
  const capabilities = getCapabilities(role);

  if (role === null) {
    if (!isAuthenticated) {
      throw new AuthorizationError("Authentication required to access this document", 401);
    }
    throw new AuthorizationError("You do not have permission to access this document", 403);
  }

  const allowed =
    (action === "read" && capabilities.canRead) ||
    (action === "edit" && capabilities.canEdit) ||
    (action === "share" && capabilities.canShare) ||
    (action === "delete" && capabilities.canDelete);

  if (!allowed) {
    if (!isAuthenticated) {
      throw new AuthorizationError("Authentication required for this action", 401);
    }
    throw new AuthorizationError(`Insufficient permissions to ${action} this document`, 403);
  }

  return capabilities;
}
