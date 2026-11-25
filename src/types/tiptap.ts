export type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
};

export type TiptapDocument = {
  type: "doc";
  content: TiptapNode[];
};

export const EMPTY_TIPTAP_DOCUMENT: TiptapDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

