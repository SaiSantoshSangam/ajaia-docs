"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import type { TiptapDocument } from "@/types/tiptap";

interface DocumentEditorProps {
  initialContent: TiptapDocument;
  editable: boolean;
  onChange?: (content: TiptapDocument) => void;
  onReady?: (editor: Editor | null) => void;
}

export function DocumentEditor({
  initialContent,
  editable,
  onChange,
  onReady,
}: DocumentEditorProps) {
  const lastSerializedRef = useRef<string>(JSON.stringify(initialContent));

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: false,
        underline: false,
      }),
      Underline,
      Highlight,
      Link.configure({
        openOnClick: !editable,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: editable
          ? "Start writing your document, or type # for a heading..."
          : "",
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "ajaia-prose min-h-[640px] px-6 py-8 sm:px-14 sm:py-12 focus:outline-none",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const json = activeEditor.getJSON() as TiptapDocument;
      lastSerializedRef.current = JSON.stringify(json);
      onChange?.(json);
    },
  });

  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(initialContent);
    if (incoming !== lastSerializedRef.current) {
      lastSerializedRef.current = incoming;
      editor.commands.setContent(initialContent, { emitUpdate: false });
    }
  }, [editor, initialContent]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {editable && (
        <div className="sticky top-14 z-20">
          <EditorToolbar editor={editor} />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
