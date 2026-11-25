import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { ImportDialog } from "@/components/dashboard/import-dialog";
import { RenameDialog } from "@/components/dashboard/rename-dialog";
import type { DocumentSummary } from "@/types/document";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

const sampleDocs: DocumentSummary[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Engineering Roadmap",
    contentText: "Q4 milestones and architecture specs",
    ownerId: "user-1",
    ownerName: "Alex Rivera",
    ownerEmail: "alex@ajaia.ai",
    isPublic: false,
    publicRole: "viewer",
    shareToken: "33333333-3333-4333-8333-333333333333",
    sourceType: "markdown",
    role: "owner",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Team Onboarding",
    contentText: "Welcome checklist for new hires",
    ownerId: "user-2",
    ownerName: "Sam Lee",
    ownerEmail: "sam@ajaia.ai",
    isPublic: true,
    publicRole: "viewer",
    shareToken: "44444444-4444-4444-8444-444444444444",
    sourceType: "blank",
    role: "viewer",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("Ajaia Docs Dashboard & Dialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders welcome heading, sidebar links, owner info, and filters by search", () => {
    render(
      <DashboardClient
        user={{ id: "user-1", email: "alex@ajaia.ai", fullName: "Alex Rivera" }}
        initialDocuments={sampleDocs}
      />
    );

    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /My Documents/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shared with Me/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recent/i })).toBeInTheDocument();

    expect(screen.getByText("Engineering Roadmap")).toBeInTheDocument();
    expect(screen.getByText("Team Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Sam Lee")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search documents");
    fireEvent.change(searchInput, { target: { value: "Roadmap" } });

    expect(screen.getByText("Engineering Roadmap")).toBeInTheDocument();
    expect(screen.queryByText("Team Onboarding")).not.toBeInTheDocument();
  });

  it("supports responsive mobile navigation drawer and empty shared state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ documents: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardClient
        user={{ id: "user-1", email: "alex@ajaia.ai", fullName: "Alex Rivera" }}
        initialDocuments={[]}
      />
    );

    expect(screen.getByText("Create your first document")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(
      screen.getByRole("button", { name: "Close navigation menu" })
    ).toBeInTheDocument();

    const sharedButtons = screen.getAllByRole("button", {
      name: /Shared with Me/i,
    });
    fireEvent.click(sharedButtons[sharedButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("No shared documents yet")).toBeInTheDocument();
    });
  });

  it("fetches scoped documents when navigating sidebar and displays error state with retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Database connection timeout" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ documents: [sampleDocs[1]] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardClient
        user={{ id: "user-1", email: "alex@ajaia.ai", fullName: "Alex Rivera" }}
        initialDocuments={sampleDocs}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Shared with Me/i }));

    await waitFor(() => {
      expect(screen.getByText("Database connection timeout")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/documents?scope=shared",
      expect.objectContaining({ cache: "no-store" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.queryByText("Database connection timeout")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Team Onboarding")).toBeInTheDocument();
  });

  it("creates a new document and navigates to the editor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        document: {
          ...sampleDocs[0],
          id: "99999999-9999-4999-8999-999999999999",
          title: "Untitled Document",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardClient
        user={{ id: "user-1", email: "alex@ajaia.ai", fullName: "Alex Rivera" }}
        initialDocuments={[]}
      />
    );

    const newButtons = screen.getAllByRole("button", { name: /New Document/i });
    fireEvent.click(newButtons[0]);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/docs/99999999-9999-4999-8999-999999999999"
      );
    });
  });

  it("renames a document via RenameDialog against PATCH /api/documents/[id]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        document: { ...sampleDocs[0], title: "Updated Roadmap" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onRenamed = vi.fn();

    render(
      <RenameDialog
        document={sampleDocs[0]}
        open={true}
        onOpenChange={vi.fn()}
        onRenamed={onRenamed}
      />
    );

    const input = screen.getByLabelText("Document title");
    fireEvent.change(input, { target: { value: "Updated Roadmap" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/documents/${sampleDocs[0].id}`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "Updated Roadmap" }),
        })
      );
      expect(onRenamed).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Updated Roadmap" })
      );
    });
  });

  it("rejects unsupported file extensions and files > 2 MB in ImportDialog", () => {
    render(
      <ImportDialog
        open={true}
        onOpenChange={vi.fn()}
        onImported={vi.fn()}
      />
    );

    const fileInput = screen.getByLabelText("Choose file to import");
    const badFile = new File(["binary"], "report.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(
      screen.getByText("Please select a .txt, .md, or .markdown file.")
    ).toBeInTheDocument();

    const oversized = new File(
      [new Uint8Array(2 * 1024 * 1024 + 1)],
      "oversized.txt",
      { type: "text/plain" }
    );
    fireEvent.change(fileInput, { target: { files: [oversized] } });

    expect(
      screen.getByText("File exceeds the 2 MB maximum size limit.")
    ).toBeInTheDocument();
  });

  it("supports drag-and-drop import, redirects to editor on success, and surfaces errors on failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Imported file cannot be empty" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          document: {
            ...sampleDocs[0],
            id: "77777777-7777-4777-8777-777777777777",
            title: "Imported Spec",
            sourceType: "markdown",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardClient
        user={{ id: "user-1", email: "alex@ajaia.ai", fullName: "Alex Rivera" }}
        initialDocuments={[]}
      />
    );

    const importBtns = screen.getAllByRole("button", { name: /Import File/i });
    fireEvent.click(importBtns[0]);

    const dropzone = screen.getByTestId("import-dropzone");
    const validMdFile = new File(["# Imported Spec\n\nBody"], "spec.md", {
      type: "text/markdown",
    });

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [validMdFile] },
    });

    // First attempt fails -> error is surfaced and dialog stays open
    fireEvent.click(screen.getByRole("button", { name: "Import document" }));
    await waitFor(() => {
      expect(screen.getByText("Imported file cannot be empty")).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();

    // Second attempt succeeds -> redirects to editor
    fireEvent.click(screen.getByRole("button", { name: "Import document" }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/docs/77777777-7777-4777-8777-777777777777"
      );
    });
  });
});
