import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";
import { DocumentEditor } from "@/components/editor/document-editor";
import {
  AUTOSAVE_DEBOUNCE_MS,
  DocumentWorkspace,
} from "@/components/editor/document-workspace";
import type { DocumentDetail } from "@/types/document";
import type { TiptapDocument } from "@/types/tiptap";

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

function makeDoc(overrides?: Partial<DocumentDetail>): DocumentDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Architecture Notes",
    contentText: "Initial paragraph",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Initial paragraph" }],
        },
      ],
    },
    ownerId: "user-1",
    ownerName: "Alice Morgan",
    ownerEmail: "alice@ajaia.demo",
    isPublic: false,
    publicRole: "viewer",
    shareToken: "22222222-2222-4222-8222-222222222222",
    sourceType: "blank",
    role: "owner",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    capabilities: {
      canRead: true,
      canEdit: true,
      canShare: true,
      canDelete: true,
    },
    ...overrides,
  };
}

describe("Tiptap DocumentEditor & DocumentWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exposes all required formatting toolbar controls and applies formatting to Tiptap JSON", async () => {
    let latestEditor: Editor | null = null;
    const onChange = vi.fn();

    render(
      <DocumentEditor
        initialContent={{
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
        }}
        editable={true}
        onChange={onChange}
        onReady={(editor) => {
          latestEditor = editor;
        }}
      />
    );

    await waitFor(() => expect(latestEditor).not.toBeNull());

    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Italic" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Underline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heading 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heading 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paragraph" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bullet list" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Numbered list" })).toBeInTheDocument();

    // Apply Heading 1, then switch back to Paragraph, apply Bold + Italic + Underline, and lists
    act(() => {
      latestEditor!.commands.selectAll();
    });
    fireEvent.click(screen.getByRole("button", { name: "Heading 1" }));
    expect((latestEditor!.getJSON() as TiptapDocument).content[0].type).toBe(
      "heading"
    );
    expect((latestEditor!.getJSON() as TiptapDocument).content[0].attrs).toEqual({
      level: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: "Heading 2" }));
    expect((latestEditor!.getJSON() as TiptapDocument).content[0].attrs).toEqual({
      level: 2,
    });

    fireEvent.click(screen.getByRole("button", { name: "Paragraph" }));
    expect((latestEditor!.getJSON() as TiptapDocument).content[0].type).toBe(
      "paragraph"
    );

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    fireEvent.click(screen.getByRole("button", { name: "Italic" }));
    fireEvent.click(screen.getByRole("button", { name: "Underline" }));

    const marks = (latestEditor!.getJSON() as TiptapDocument).content[0]
      .content?.[0].marks?.map((m) => m.type);
    expect(marks).toEqual(expect.arrayContaining(["bold", "italic", "underline"]));

    fireEvent.click(screen.getByRole("button", { name: "Bullet list" }));
    expect((latestEditor!.getJSON() as TiptapDocument).content[0].type).toBe(
      "bulletList"
    );

    fireEvent.click(screen.getByRole("button", { name: "Numbered list" }));
    expect((latestEditor!.getJSON() as TiptapDocument).content[0].type).toBe(
      "orderedList"
    );
  });

  it("autosaves after 800ms, prevents duplicate requests, and preserves formatting across full page refresh", async () => {
    vi.useFakeTimers();

    // Simulated PostgreSQL JSONB persistence store
    let persistedDoc = makeDoc();

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        title?: string;
        content?: TiptapDocument;
      };
      persistedDoc = {
        ...persistedDoc,
        title: body.title ?? persistedDoc.title,
        content: body.content ?? persistedDoc.content,
        updatedAt: new Date().toISOString(),
      };
      return {
        ok: true,
        json: async () => ({ document: persistedDoc }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const richFormattedDoc: TiptapDocument = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Executive Summary" }],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Key Formatting" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "bold" }], text: "Bold" },
            { type: "text", text: " " },
            { type: "text", marks: [{ type: "italic" }], text: "Italic" },
            { type: "text", text: " " },
            { type: "text", marks: [{ type: "underline" }], text: "Underlined" },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Bullet one" }] },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Numbered one" }] },
              ],
            },
          ],
        },
      ],
    };

    const initialDoc = makeDoc({ content: richFormattedDoc });
    const { unmount } = render(
      <DocumentWorkspace
        initialDocument={initialDoc}
        user={{ id: "user-1", email: "alice@ajaia.demo", fullName: "Alice Morgan" }}
      />
    );

    // Clicking Save with no edits must NOT send an unnecessary DB request
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));
    expect(fetchMock).not.toHaveBeenCalled();

    // Edit title -> should wait 800ms before saving
    const titleInput = screen.getByLabelText("Document title");
    fireEvent.change(titleInput, { target: { value: "Persisted Spec" } });
    expect(screen.getAllByText("Unsaved changes")[0]).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 100);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(persistedDoc.title).toBe("Persisted Spec");
    expect(persistedDoc.content).toEqual(richFormattedDoc);
    expect(screen.getAllByText("Saved")[0]).toBeInTheDocument();

    // Simulate full page refresh by unmounting and remounting with persisted DB record
    unmount();

    render(
      <DocumentWorkspace
        initialDocument={persistedDoc}
        user={{ id: "user-1", email: "alice@ajaia.demo", fullName: "Alice Morgan" }}
      />
    );

    expect(screen.getByLabelText("Document title")).toHaveValue("Persisted Spec");
    expect(screen.getByRole("heading", { level: 1, name: "Executive Summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Key Formatting" })).toBeInTheDocument();
    expect(screen.getByText("Bold").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByText("Italic").tagName.toLowerCase()).toBe("em");
    expect(screen.getByText("Underlined").tagName.toLowerCase()).toBe("u");
    expect(screen.getByText("Bullet one")).toBeInTheDocument();
    expect(screen.getByText("Numbered one")).toBeInTheDocument();
  });

  it("shows Save failed state on error and recovers on Retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Database write failed" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ document: makeDoc({ title: "Recovered Title" }) }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DocumentWorkspace
        initialDocument={makeDoc()}
        user={{ id: "user-1", email: "alice@ajaia.demo", fullName: "Alice Morgan" }}
      />
    );

    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Recovered Title" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Save failed")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Retry save/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Saved")[0]).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("disables editing for viewer permissions", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const viewerDoc = makeDoc({
      role: "viewer",
      capabilities: {
        canRead: true,
        canEdit: false,
        canShare: false,
        canDelete: false,
      },
    });

    render(
      <DocumentWorkspace
        initialDocument={viewerDoc}
        user={{ id: "user-3", email: "carol@ajaia.demo", fullName: "Carol Davis" }}
      />
    );

    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Document title")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Architecture Notes" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Read-only (viewer)")[0]).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows editing for editor permissions while hiding owner-only Share controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ document: makeDoc({ title: "Editor Updated" }) }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const editorDoc = makeDoc({
      role: "editor",
      capabilities: {
        canRead: true,
        canEdit: true,
        canShare: false,
        canDelete: false,
      },
    });

    render(
      <DocumentWorkspace
        initialDocument={editorDoc}
        user={{ id: "user-2", email: "bob@ajaia.demo", fullName: "Bob Chen" }}
      />
    );

    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Share$/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Editor Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("flushes unsaved changes before navigating Back to dashboard and warns on beforeunload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ document: makeDoc({ title: "Flushed Title" }) }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DocumentWorkspace
        initialDocument={makeDoc()}
        user={{ id: "user-1", email: "alice@ajaia.demo", fullName: "Alice Morgan" }}
      />
    );

    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Flushed Title" },
    });

    // Verify beforeunload triggers preventDefault while unsaved
    const unloadEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);

    // Click Back to dashboard before 800ms timer fires -> flushes save first, then navigates
    fireEvent.click(screen.getByRole("button", { name: /Back to dashboard/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});

