// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInMemorySupabase,
  TEST_ALICE,
  TEST_BOB,
  TEST_CAROL,
} from "./helpers/in-memory-supabase";

let activeUser: { id: string; email: string } | null = null;
let dbClient = createInMemorySupabase(() => activeUser);

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => dbClient),
}));

import { GET as listDocs, POST as createDoc } from "@/app/api/documents/route";
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

describe("End-to-End Document Sharing & Direct API Authorization", () => {
  beforeEach(() => {
    activeUser = null;
    dbClient = createInMemorySupabase(() => activeUser);
  });

  it("enforces server-side Viewer, Editor, and Owner permissions across direct HTTP API calls", async () => {
    // 0. Unauthenticated requests receive 401
    activeUser = null;
    const unauthList = await listDocs(
      new Request("http://localhost/api/documents")
    );
    expect(unauthList.status).toBe(401);

    // 1. Alice creates a document
    activeUser = TEST_ALICE;
    const createRes = await createDoc(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Q4 Strategy",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Original strategy text" }],
              },
            ],
          },
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const { document: createdDoc } = await createRes.json();
    const docId = createdDoc.id as string;

    // 2. Unauthenticated and unshared users calling direct API receive 401 / 403
    activeUser = null;
    const unauthGet = await getDoc(
      new Request(`http://localhost/api/documents/${docId}`),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(unauthGet.status).toBe(401);

    activeUser = TEST_BOB;
    const bobBeforeShare = await getDoc(
      new Request(`http://localhost/api/documents/${docId}`),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobBeforeShare.status).toBe(403);

    // 3. Alice shares with Bob as Viewer
    activeUser = TEST_ALICE;
    const shareRes = await postShare(
      new Request(`http://localhost/api/documents/${docId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_BOB.email, role: "viewer" }),
      }),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(shareRes.status).toBe(201);
    const { collaborator: bobShare } = await shareRes.json();
    expect(bobShare.role).toBe("viewer");

    // 4. Dashboard scopes: Alice sees it in owned, Bob sees it in shared with owner info
    const aliceOwnedRes = await listDocs(
      new Request("http://localhost/api/documents?scope=owned")
    );
    expect((await aliceOwnedRes.json()).documents).toHaveLength(1);

    activeUser = TEST_BOB;
    const bobSharedRes = await listDocs(
      new Request("http://localhost/api/documents?scope=shared")
    );
    const bobSharedList = (await bobSharedRes.json()).documents;
    expect(bobSharedList).toHaveLength(1);
    expect(bobSharedList[0].role).toBe("viewer");
    expect(bobSharedList[0].ownerName).toBe(TEST_ALICE.fullName);

    const bobOwnedRes = await listDocs(
      new Request("http://localhost/api/documents?scope=owned")
    );
    expect((await bobOwnedRes.json()).documents).toHaveLength(0);

    // 5. DIRECT API BYPASS TEST: Bob (Viewer) can read, but CANNOT edit, share, or delete
    const bobGetRes = await getDoc(
      new Request(`http://localhost/api/documents/${docId}`),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobGetRes.status).toBe(200);

    const bobDirectEditRes = await patchDoc(
      new Request(`http://localhost/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Tampered by Viewer",
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Tampered" }] }],
          },
        }),
      }),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobDirectEditRes.status).toBe(403);

    const bobDirectShareRes = await postShare(
      new Request(`http://localhost/api/documents/${docId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_CAROL.email, role: "editor" }),
      }),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobDirectShareRes.status).toBe(403);

    const bobDirectDeleteRes = await deleteDoc(
      new Request(`http://localhost/api/documents/${docId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobDirectDeleteRes.status).toBe(403);

    // Confirm database content was NOT altered by Viewer's direct API attempt
    activeUser = TEST_ALICE;
    const verifyIntact = await getDoc(
      new Request(`http://localhost/api/documents/${docId}`),
      { params: Promise.resolve({ id: docId }) }
    );
    const intactJson = await verifyIntact.json();
    expect(intactJson.document.title).toBe("Q4 Strategy");
    expect(intactJson.document.contentText).toBe("Original strategy text");

    // 6. Alice upgrades Bob to Editor -> Bob can now edit via API, still cannot share or delete
    const promoteRes = await patchShareRole(
      new Request(
        `http://localhost/api/documents/${docId}/shares/${bobShare.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "editor" }),
        }
      ),
      { params: Promise.resolve({ id: docId, shareId: bobShare.id }) }
    );
    expect(promoteRes.status).toBe(200);

    activeUser = TEST_BOB;
    const bobEditorPatchRes = await patchDoc(
      new Request(`http://localhost/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Q4 Strategy (Updated by Bob)",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Updated by Editor Bob" }],
              },
            ],
          },
        }),
      }),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobEditorPatchRes.status).toBe(200);
    expect((await bobEditorPatchRes.json()).document.title).toBe(
      "Q4 Strategy (Updated by Bob)"
    );

    const bobEditorListShares = await getShares(
      new Request(`http://localhost/api/documents/${docId}/shares`),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobEditorListShares.status).toBe(403);

    const bobEditorDeleteRes = await deleteDoc(
      new Request(`http://localhost/api/documents/${docId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobEditorDeleteRes.status).toBe(403);

    // 7. Alice revokes Bob's sharing access -> Bob loses all access immediately
    activeUser = TEST_ALICE;
    const revokeRes = await deleteShare(
      new Request(
        `http://localhost/api/documents/${docId}/shares/${bobShare.id}`,
        { method: "DELETE" }
      ),
      { params: Promise.resolve({ id: docId, shareId: bobShare.id }) }
    );
    expect(revokeRes.status).toBe(200);

    activeUser = TEST_BOB;
    const bobAfterRevokeGet = await getDoc(
      new Request(`http://localhost/api/documents/${docId}`),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobAfterRevokeGet.status).toBe(403);

    const bobAfterRevokePatch = await patchDoc(
      new Request(`http://localhost/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Stale editor attempt" }),
      }),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(bobAfterRevokePatch.status).toBe(403);

    const bobAfterRevokeList = await listDocs(
      new Request("http://localhost/api/documents?scope=shared")
    );
    expect((await bobAfterRevokeList.json()).documents).toHaveLength(0);

    // 8. Reopening document as Owner returns latest persisted Tiptap JSONB & capabilities
    activeUser = TEST_ALICE;
    const reopenedRes = await getDoc(
      new Request(`http://localhost/api/documents/${docId}`),
      { params: Promise.resolve({ id: docId }) }
    );
    expect(reopenedRes.status).toBe(200);
    const reopenedJson = await reopenedRes.json();
    expect(reopenedJson.document.title).toBe("Q4 Strategy (Updated by Bob)");
    expect(reopenedJson.document.contentText).toBe("Updated by Editor Bob");
    expect(reopenedJson.document.capabilities).toEqual({
      canRead: true,
      canEdit: true,
      canShare: true,
      canDelete: true,
    });
  });
});

