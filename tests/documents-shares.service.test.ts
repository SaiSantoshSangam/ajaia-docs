import { describe, expect, it } from "vitest";
import { AuthorizationError } from "@/services/authorization";
import {
  createDocument,
  deleteDocument,
  getDocumentForUser,
  listOwnedDocuments,
  listSharedDocuments,
  renameDocument,
  updateDocumentContent,
} from "@/services/documents.service";
import {
  addOrUpdateCollaborator,
  getShareSettings,
  revokeCollaborator,
  updateCollaboratorRole,
  updatePublicAccess,
} from "@/services/shares.service";
import type { TiptapDocument } from "@/types/tiptap";
import {
  createInMemorySupabase,
  TEST_ALICE,
  TEST_BOB,
  TEST_CAROL,
} from "./helpers/in-memory-supabase";

describe("backend document and sharing service operations", () => {
  it("supports full lifecycle: create, get, list owned/shared, rename, update JSONB content, share, update role, revoke, delete", async () => {
    const supabase = createInMemorySupabase();

    // 1. Create document (Alice)
    const richContent: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "System Spec" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Stored as " },
            { type: "text", marks: [{ type: "bold" }], text: "JSONB" },
          ],
        },
      ],
    };

    const created = await createDocument(supabase, TEST_ALICE, {
      title: "Initial Spec",
      content: richContent,
      sourceType: "markdown",
    });

    expect(created.ownerId).toBe(TEST_ALICE.id);
    expect(created.role).toBe("owner");
    expect(created.content).toEqual(richContent);
    expect(created.contentText).toContain("Stored as JSONB");

    // 2. Get document (Alice succeeds, Bob denied before sharing)
    const fetchedByAlice = await getDocumentForUser(
      supabase,
      TEST_ALICE,
      created.id
    );
    expect(fetchedByAlice.title).toBe("Initial Spec");

    await expect(
      getDocumentForUser(supabase, TEST_BOB, created.id)
    ).rejects.toMatchObject({ status: 403 });

    // 3. Share document (Alice shares with Bob as viewer, Carol as viewer)
    const bobShare = await addOrUpdateCollaborator(
      supabase,
      TEST_ALICE,
      created.id,
      { email: TEST_BOB.email, role: "viewer" }
    );
    const carolShare = await addOrUpdateCollaborator(
      supabase,
      TEST_ALICE,
      created.id,
      { email: TEST_CAROL.email, role: "viewer" }
    );
    expect(bobShare.userId).toBe(TEST_BOB.id);
    expect(carolShare.role).toBe("viewer");

    // 4. List owned vs shared documents
    const aliceOwned = await listOwnedDocuments(supabase, TEST_ALICE);
    const aliceShared = await listSharedDocuments(supabase, TEST_ALICE);
    expect(aliceOwned).toHaveLength(1);
    expect(aliceShared).toHaveLength(0);

    const bobOwned = await listOwnedDocuments(supabase, TEST_BOB);
    const bobShared = await listSharedDocuments(supabase, TEST_BOB);
    expect(bobOwned).toHaveLength(0);
    expect(bobShared).toHaveLength(1);
    expect(bobShared[0].role).toBe("viewer");

    // 5. Viewer cannot rename, update content, share, or delete
    await expect(
      renameDocument(supabase, TEST_BOB, created.id, "Hacked Title")
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateDocumentContent(supabase, TEST_BOB, created.id, richContent)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      addOrUpdateCollaborator(supabase, TEST_BOB, created.id, {
        email: TEST_CAROL.email,
        role: "editor",
      })
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      deleteDocument(supabase, TEST_BOB, created.id)
    ).rejects.toMatchObject({ status: 403 });

    // 6. Update sharing permission: Alice promotes Bob to editor
    const promoted = await updateCollaboratorRole(
      supabase,
      TEST_ALICE,
      created.id,
      bobShare.id,
      "editor"
    );
    expect(promoted.role).toBe("editor");

    // 7. Editor (Bob) can rename and update JSONB content, but still cannot share or delete
    const renamedByBob = await renameDocument(
      supabase,
      TEST_BOB,
      created.id,
      "System Spec v2"
    );
    expect(renamedByBob.title).toBe("System Spec v2");

    const updatedJsonb: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Edited by Bob" }],
        },
      ],
    };
    const contentUpdated = await updateDocumentContent(
      supabase,
      TEST_BOB,
      created.id,
      updatedJsonb
    );
    expect(contentUpdated.content).toEqual(updatedJsonb);
    expect(contentUpdated.contentText).toBe("Edited by Bob");

    await expect(
      getShareSettings(supabase, TEST_BOB, created.id)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      deleteDocument(supabase, TEST_BOB, created.id)
    ).rejects.toMatchObject({ status: 403 });

    // 8. Non-owner cannot revoke or toggle public access
    await expect(
      revokeCollaborator(supabase, TEST_BOB, created.id, carolShare.id)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updatePublicAccess(supabase, TEST_BOB, created.id, { isPublic: true })
    ).rejects.toMatchObject({ status: 403 });

    // 9. Owner revokes Carol's access -> Carol immediately loses read access
    await revokeCollaborator(supabase, TEST_ALICE, created.id, carolShare.id);
    await expect(
      getDocumentForUser(supabase, TEST_CAROL, created.id)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      revokeCollaborator(supabase, TEST_ALICE, created.id, carolShare.id)
    ).rejects.toBeInstanceOf(AuthorizationError);

    // 10. Owner deletes document -> 404 thereafter
    await deleteDocument(supabase, TEST_ALICE, created.id);
    await expect(
      getDocumentForUser(supabase, TEST_ALICE, created.id)
    ).rejects.toMatchObject({ status: 404 });
  });
});
