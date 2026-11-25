import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareDialog } from "@/components/editor/share-dialog";

describe("ShareDialog frontend sharing workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads collaborators, shares with a demo user, updates permissions, and revokes access", async () => {
    const bobShare = {
      id: "share-bob-1",
      documentId: "doc-1",
      email: "bob@ajaia.demo",
      userId: "10000000-0000-4000-8000-000000000002",
      fullName: "Bob Chen",
      role: "viewer" as const,
      createdAt: new Date().toISOString(),
    };

    const fetchMock = vi
      .fn()
      // 1. Initial GET /api/documents/doc-1/shares
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isPublic: false,
          publicRole: "viewer",
          shareToken: "token-123",
          collaborators: [],
        }),
      })
      // 2. POST /api/documents/doc-1/shares (quick-share with Bob)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ collaborator: bobShare }),
      })
      // 3. PATCH /api/documents/doc-1/shares/share-bob-1 (promote to editor)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          collaborator: { ...bobShare, role: "editor" },
        }),
      })
      // 4. DELETE /api/documents/doc-1/shares/share-bob-1 (revoke)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ revoked: true }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShareDialog
        documentId="doc-1"
        documentTitle="Architecture Spec"
        currentUserEmail="alice@ajaia.demo"
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // Wait for initial share settings & demo user quick-add chips
    await waitFor(() => {
      expect(screen.getByText("Collaborators (0)")).toBeInTheDocument();
    });

    // Alice should not appear in quick-add chips; Bob and Carol should
    expect(screen.queryByText(/\+ Alice Morgan/)).not.toBeInTheDocument();
    const bobQuickBtn = screen.getByRole("button", {
      name: /\+ Bob Chen \(viewer\)/i,
    });
    fireEvent.click(bobQuickBtn);

    await waitFor(() => {
      expect(screen.getByText("Collaborators (1)")).toBeInTheDocument();
      expect(screen.getByText("Bob Chen")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/documents/doc-1/shares",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "bob@ajaia.demo", role: "viewer" }),
      })
    );

    // Update Bob's permission via role selector
    const roleTrigger = screen.getByLabelText("Role for bob@ajaia.demo");
    fireEvent.click(roleTrigger);
    const editorOption = await screen.findByRole("option", { name: "Editor" });
    fireEvent.click(editorOption);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/documents/doc-1/shares/share-bob-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "editor" }),
        })
      );
    });

    // Revoke Bob's access
    const removeBtn = screen.getByLabelText("Remove bob@ajaia.demo");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.getByText("Collaborators (0)")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/documents/doc-1/shares/share-bob-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

