// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/services/authorization";

const mockGetUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockFrom = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
    signInWithPassword: mockSignInWithPassword,
  },
  from: mockFrom,
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => mockSupabaseClient),
}));

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseEnv: vi.fn(() => ({
    url: "https://example.supabase.co",
    anonKey: "anon-key",
  })),
  getAppUrl: vi.fn(() => "http://localhost:3000"),
}));

const mockListUserDocuments = vi.fn();
const mockCreateDocument = vi.fn();
const mockGetDocumentForUser = vi.fn();
const mockUpdateDocument = vi.fn();
const mockDeleteDocument = vi.fn();

vi.mock("@/services/documents.service", () => ({
  listUserDocuments: (...args: unknown[]) => mockListUserDocuments(...args),
  createDocument: (...args: unknown[]) => mockCreateDocument(...args),
  getDocumentForUser: (...args: unknown[]) => mockGetDocumentForUser(...args),
  updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  deleteDocument: (...args: unknown[]) => mockDeleteDocument(...args),
}));

const mockAddOrUpdateCollaborator = vi.fn();
const mockUpdateCollaboratorRole = vi.fn();
const mockRevokeCollaborator = vi.fn();
const mockUpdatePublicAccess = vi.fn();
const mockGetShareSettings = vi.fn();

vi.mock("@/services/shares.service", () => ({
  getShareSettings: (...args: unknown[]) => mockGetShareSettings(...args),
  addOrUpdateCollaborator: (...args: unknown[]) =>
    mockAddOrUpdateCollaborator(...args),
  updateCollaboratorRole: (...args: unknown[]) =>
    mockUpdateCollaboratorRole(...args),
  revokeCollaborator: (...args: unknown[]) => mockRevokeCollaborator(...args),
  updatePublicAccess: (...args: unknown[]) => mockUpdatePublicAccess(...args),
}));

import { GET as listDocs, POST as createDoc } from "@/app/api/documents/route";
import { POST as importDoc } from "@/app/api/documents/import/route";
import {
  DELETE as deleteDoc,
  GET as getDoc,
  PATCH as patchDoc,
} from "@/app/api/documents/[id]/route";
import {
  GET as getShares,
  POST as postShare,
} from "@/app/api/documents/[id]/shares/route";
import {
  DELETE as deleteShare,
  PATCH as patchShareRole,
} from "@/app/api/documents/[id]/shares/[shareId]/route";
import {
  GET as getDemoAccounts,
  POST as postDemoSwitch,
} from "@/app/api/auth/demo-switch/route";
import { GET as getHealth } from "@/app/api/health/route";

const DOC_ID = "11111111-1111-4111-8111-111111111111";
const SHARE_ID = "22222222-2222-4222-8222-222222222222";

describe("API Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated on protected routes", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await listDocs(new Request("http://localhost/api/documents"));
    expect(res.status).toBe(401);

    const patchRes = await patchDoc(
      new Request(`http://localhost/api/documents/${DOC_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ id: DOC_ID }) }
    );
    expect(patchRes.status).toBe(401);
  });

  it("supports ?scope=owned and ?scope=shared and rejects invalid scopes", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "alice@ajaia.demo" } },
    });
    mockListUserDocuments.mockResolvedValue([]);

    const ownedRes = await listDocs(
      new Request("http://localhost/api/documents?scope=owned")
    );
    expect(ownedRes.status).toBe(200);
    expect(mockListUserDocuments).toHaveBeenCalledWith(
      mockSupabaseClient,
      { id: "user-1", email: "alice@ajaia.demo" },
      "owned"
    );

    const sharedRes = await listDocs(
      new Request("http://localhost/api/documents?scope=shared")
    );
    expect(sharedRes.status).toBe(200);
    expect(mockListUserDocuments).toHaveBeenCalledWith(
      mockSupabaseClient,
      { id: "user-1", email: "alice@ajaia.demo" },
      "shared"
    );

    const badScope = await listDocs(
      new Request("http://localhost/api/documents?scope=everyone")
    );
    expect(badScope.status).toBe(400);
  });

  it("rejects client-supplied userId/ownerId fields with 400 via strict Zod schemas", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "alice@ajaia.demo" } },
    });

    const spoofCreateRes = await createDoc(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Spoofed Doc",
          ownerId: "99999999-9999-4999-8999-999999999999",
        }),
      })
    );
    expect(spoofCreateRes.status).toBe(400);
    expect(mockCreateDocument).not.toHaveBeenCalled();

    const spoofShareRes = await postShare(
      new Request(`http://localhost/api/documents/${DOC_ID}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "bob@ajaia.demo",
          role: "editor",
          createdBy: "someone-else",
        }),
      }),
      { params: Promise.resolve({ id: DOC_ID }) }
    );
    expect(spoofShareRes.status).toBe(400);
    expect(mockAddOrUpdateCollaborator).not.toHaveBeenCalled();
  });

  it("returns 400 when document id is not a valid UUID", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@ajaia.ai" } },
    });

    const res = await getDoc(new Request("http://localhost/api/documents/bad"), {
      params: Promise.resolve({ id: "bad" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates, imports, updates, and manages shares with Zod validation", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "alice@ajaia.demo" } },
    });
    mockCreateDocument.mockResolvedValue({
      id: DOC_ID,
      title: "Product Plan",
      sourceType: "markdown",
    });
    mockUpdateCollaboratorRole.mockResolvedValue({
      id: SHARE_ID,
      email: "bob@ajaia.demo",
      role: "editor",
    });

    const createRes = await createDoc(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Product Plan" }),
      })
    );
    expect(createRes.status).toBe(201);

    const importRes = await importDoc(
      new Request("http://localhost/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "plan.md",
          rawContent: "# Product Plan\n\nDetails",
        }),
      })
    );
    expect(importRes.status).toBe(201);

    const roleRes = await patchShareRole(
      new Request(
        `http://localhost/api/documents/${DOC_ID}/shares/${SHARE_ID}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "editor" }),
        }
      ),
      { params: Promise.resolve({ id: DOC_ID, shareId: SHARE_ID }) }
    );
    expect(roleRes.status).toBe(200);

    const revokeRes = await deleteShare(
      new Request(
        `http://localhost/api/documents/${DOC_ID}/shares/${SHARE_ID}`,
        { method: "DELETE" }
      ),
      { params: Promise.resolve({ id: DOC_ID, shareId: SHARE_ID }) }
    );
    expect(revokeRes.status).toBe(200);
  });

  it("propagates 403 authorization errors on PATCH, DELETE, and sharing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "viewer-1", email: "carol@ajaia.demo" } },
    });
    mockUpdateDocument.mockRejectedValue(
      new AuthorizationError("Insufficient permissions to edit this document", 403)
    );
    mockDeleteDocument.mockRejectedValue(
      new AuthorizationError("Insufficient permissions to delete this document", 403)
    );
    mockAddOrUpdateCollaborator.mockRejectedValue(
      new AuthorizationError("Insufficient permissions to share this document", 403)
    );
    mockGetShareSettings.mockRejectedValue(
      new AuthorizationError("Insufficient permissions to share this document", 403)
    );

    const patchRes = await patchDoc(
      new Request(`http://localhost/api/documents/${DOC_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hack" }),
      }),
      { params: Promise.resolve({ id: DOC_ID }) }
    );
    expect(patchRes.status).toBe(403);

    const deleteRes = await deleteDoc(
      new Request(`http://localhost/api/documents/${DOC_ID}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: DOC_ID }) }
    );
    expect(deleteRes.status).toBe(403);

    const getSharesRes = await getShares(
      new Request(`http://localhost/api/documents/${DOC_ID}/shares`),
      { params: Promise.resolve({ id: DOC_ID }) }
    );
    expect(getSharesRes.status).toBe(403);

    const shareRes = await postShare(
      new Request(`http://localhost/api/documents/${DOC_ID}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "other@ajaia.ai", role: "editor" }),
      }),
      { params: Promise.resolve({ id: DOC_ID }) }
    );
    expect(shareRes.status).toBe(403);
  });

  it("validates demo account switcher allowlist and signs in via Supabase Auth", async () => {
    const listRes = await getDemoAccounts();
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.accounts).toHaveLength(3);

    const invalidDemo = await postDemoSwitch(
      new Request("http://localhost/api/auth/demo-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "attacker@evil.com" }),
      })
    );
    expect(invalidDemo.status).toBe(400);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();

    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "10000000-0000-4000-8000-000000000002",
          email: "bob@ajaia.demo",
          user_metadata: { full_name: "Bob Chen" },
        },
      },
      error: null,
    });

    const validDemo = await postDemoSwitch(
      new Request("http://localhost/api/auth/demo-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "bob@ajaia.demo" }),
      })
    );
    expect(validDemo.status).toBe(200);
    const demoJson = await validDemo.json();
    expect(demoJson.user.email).toBe("bob@ajaia.demo");
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
  });

  it("handles multipart File import (.txt and .md), rejects >2MB / unsupported / binary files, and assigns current user as owner", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "alice@ajaia.demo" } },
    });
    mockCreateDocument.mockResolvedValue({
      id: DOC_ID,
      ownerId: "user-1",
      title: "Imported Guide",
      sourceType: "markdown",
    });

    const validForm = new FormData();
    validForm.append(
      "file",
      new File(["# Imported Guide\n\n- Step 1\n- Step 2"], "guide.md", {
        type: "text/markdown",
      })
    );

    const okRes = await importDoc(
      new Request("http://localhost/api/documents/import", {
        method: "POST",
        body: validForm,
      })
    );
    expect(okRes.status).toBe(201);
    expect(mockCreateDocument).toHaveBeenCalledWith(
      mockSupabaseClient,
      { id: "user-1", email: "alice@ajaia.demo" },
      expect.objectContaining({
        title: "Imported Guide",
        sourceType: "markdown",
      })
    );

    const badExtForm = new FormData();
    badExtForm.append(
      "file",
      new File(["%PDF-1.4"], "report.pdf", { type: "application/pdf" })
    );
    const badExtRes = await importDoc(
      new Request("http://localhost/api/documents/import", {
        method: "POST",
        body: badExtForm,
      })
    );
    expect(badExtRes.status).toBe(400);

    const tooBigForm = new FormData();
    tooBigForm.append(
      "file",
      new File([new Uint8Array(2 * 1024 * 1024 + 10)], "big.txt", {
        type: "text/plain",
      })
    );
    const tooBigRes = await importDoc(
      new Request("http://localhost/api/documents/import", {
        method: "POST",
        body: tooBigForm,
      })
    );
    expect(tooBigRes.status).toBe(400);

    const binaryRes = await importDoc(
      new Request("http://localhost/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "fake.txt",
          rawContent: "hello\u0000world",
        }),
      })
    );
    expect(binaryRes.status).toBe(400);
  });

  it("rejects invalid document inputs and malformed JSON with 400", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "alice@ajaia.demo" } },
    });

    const malformedJsonRes = await createDoc(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      })
    );
    expect(malformedJsonRes.status).toBe(400);

    const emptyTitleRes = await createDoc(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "   " }),
      })
    );
    expect(emptyTitleRes.status).toBe(400);

    const badTiptapRes = await createDoc(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Valid Title",
          content: { type: "paragraph", content: [] },
        }),
      })
    );
    expect(badTiptapRes.status).toBe(400);

    const emptyPatchRes = await patchDoc(
      new Request(`http://localhost/api/documents/${DOC_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: DOC_ID }) }
    );
    expect(emptyPatchRes.status).toBe(400);

    const badShareRes = await postShare(
      new Request(`http://localhost/api/documents/${DOC_ID}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", role: "admin" }),
      }),
      { params: Promise.resolve({ id: DOC_ID }) }
    );
    expect(badShareRes.status).toBe(400);
  });

  it("checks database connectivity on /api/health", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const okRes = await getHealth();
    expect(okRes.status).toBe(200);
    expect((await okRes.json()).database).toBe("connected");

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          error: { message: "permission denied for table documents" },
        }),
      }),
    });
    const errRes = await getHealth();
    expect(errRes.status).toBe(503);
    expect((await errRes.json()).database).toBe("error");
  });
});
