# Ajaia Docs — Architecture

This document describes the system architecture, data model, persistence strategy, authorization boundaries, autosave design, and engineering tradeoffs of **Ajaia Docs**.

---

## 1. Frontend & Backend Architecture

Ajaia Docs follows a clean layered architecture built on **Next.js App Router**:

```text
Browser (React 19 + Tiptap + Tailwind/shadcn UI)
  │
  ├─ Server Components (SSR Auth & Initial Data Load)
  │    ├─ src/app/dashboard/page.tsx
  │    ├─ src/app/docs/[id]/page.tsx
  │    └─ src/app/share/[token]/page.tsx
  │
  ├─ Proxy Session Refresh (Next.js 16)
  │    └─ src/proxy.ts -> src/lib/supabase/middleware.ts
  │
  └─ REST Route Handlers (src/app/api/*)
       ├─ Zod Strict Input Validation (src/lib/validations/*)
       ├─ Domain Services (src/services/*)
       │    ├─ authorization.ts
       │    ├─ documents.service.ts
       │    ├─ shares.service.ts
       │    └─ import-parser.ts
       └─ Supabase SSR Client (src/lib/supabase/server.ts)
            └─ PostgreSQL + Row Level Security (supabase/migrations/001_initial_schema.sql)
```

### Layer Responsibilities
- **Proxy (`src/proxy.ts`)**: Refreshes Supabase SSR session cookies on incoming requests and performs optimistic redirects for unauthenticated access to `/dashboard` and `/docs/*`.
- **Server Components (`src/app/`)**: Wrapped in `<Suspense>` boundaries for Next.js 16 `cacheComponents` compatibility. They verify user identity via `supabase.auth.getUser()`, enforce read authorization server-side before rendering, and hydrate client workspaces with typed domain DTOs (`DocumentSummary`, `DocumentDetail`).
- **Route Handlers (`src/app/api/`)**: Handle all mutations and dynamic queries (`/api/documents`, `/api/documents/import`, `/api/documents/[id]`, `/api/documents/[id]/shares`, `/api/documents/[id]/shares/[shareId]`, `/api/auth/demo-switch`, `/api/health`).
- **Services (`src/services/`)**: Pure TypeScript modules receiving an authenticated `SupabaseClient` and verified `AuthUser`, keeping business rules testable independent of Next.js HTTP primitives.

---

## 2. Database Schema

Defined in [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql):

### `public.users`
- `id` (`uuid`, PK, FK -> `auth.users(id)` `ON DELETE CASCADE`)
- `email` (`text`, unique, not null)
- `full_name` (`text`), `avatar_url` (`text`)
- `created_at`, `updated_at` (`timestamptz`)
- Automatically populated on user registration via the `on_auth_user_created` trigger (`public.handle_new_user()`), which also backfills `shared_with_user_id` on any pending email shares.

### `public.documents`
- `id` (`uuid`, PK, `gen_random_uuid()`)
- `owner_id` (`uuid`, FK -> `public.users(id)` `ON DELETE CASCADE`)
- `title` (`text`, not null, default `'Untitled Document'`)
- `content` (`jsonb`, not null, stores Tiptap ProseMirror document tree)
- `content_text` (`text`, not null, plain-text extract for dashboard snippets and search)
- `is_public` (`boolean`, not null, default `false`)
- `public_role` (`text`, check in `('viewer', 'editor')`, default `'viewer'`)
- `share_token` (`uuid`, unique, `gen_random_uuid()`)
- `source_type` (`text`, check in `('blank', 'markdown', 'txt')`, default `'blank'`)
- `created_at`, `updated_at` (`timestamptz`)

### `public.document_shares`
- `id` (`uuid`, PK, `gen_random_uuid()`)
- `document_id` (`uuid`, FK -> `public.documents(id)` `ON DELETE CASCADE`)
- `shared_with_user_id` (`uuid`, nullable FK -> `public.users(id)` `ON DELETE CASCADE`)
- `shared_with_email` (`text`, not null)
- `role` (`text`, check in `('viewer', 'editor')`, not null, default `'viewer'`)
- `created_by` (`uuid`, FK -> `public.users(id)` `ON DELETE CASCADE`)
- `created_at`, `updated_at` (`timestamptz`)
- Unique constraint `uq_document_share_email (document_id, shared_with_email)` prevents duplicate share rows for the same recipient.

---

## 3. Document Persistence

- **JSONB Rich-Text Storage**: The Tiptap editor produces a structured ProseMirror JSON tree (`{ type: "doc", content: [...] }`). On save (`PATCH /api/documents/[id]`), the JSON tree is validated with `tiptapDocumentSchema` and persisted directly in `documents.content` (`jsonb`).
- **Plain-Text Index (`content_text`)**: `extractPlainTextFromTiptap()` (`src/lib/utils.ts`) derives normalized plain text on every create, import, and update so dashboard cards and client search work without traversing nested JSONB nodes on the client.
- **File Import Pipeline**: `src/services/import-parser.ts` parses uploaded `.txt` and `.md` files (up to 2 MB) directly into Tiptap JSON nodes (`heading`, `paragraph`, `bulletList`, `orderedList`, `taskList`, `blockquote`, `codeBlock`, `horizontalRule`, inline `bold`/`italic`/`strike`/`code`/safe `link` marks) and persists them via `createDocument()`.
- **Reload Integrity**: Server pages (`/docs/[id]` and `/share/[token]`) key `<DocumentWorkspace>` by `${document.id}:${document.updatedAt}` so reopening or refreshing always hydrates from the latest PostgreSQL state.

---

## 4. Sharing Model

Ajaia Docs supports two complementary sharing mechanisms:

1. **Direct Collaborator Sharing (`document_shares`)**:
   - Owners invite collaborators by email (or quick-add existing demo accounts) with either `viewer` or `editor` role.
   - Shares work even before a recipient signs up because `shared_with_email` is matched case-insensitively and linked to `shared_with_user_id` automatically when the user registers.
   - Owners can upgrade/downgrade roles (`PATCH /api/documents/[id]/shares/[shareId]`) or revoke access immediately (`DELETE /api/documents/[id]/shares/[shareId]`).
2. **Tokenized Public Link Sharing (`is_public`, `public_role`, `share_token`)**:
   - Owners can toggle link sharing at `/share/[token]`, choose whether signed-in visitors get `viewer` or `editor` permissions, and rotate `share_token` at any time to invalidate old URLs.
   - Unauthenticated link visitors are always capped to read-only `viewer` access.

---

## 5. Permission Enforcement

Authorization follows **defense-in-depth** across three layers—UI controls are strictly cosmetic convenience and never trusted as security boundaries:

| Capability | Owner | Editor | Viewer | Unshared / Anon |
| :--- | :---: | :---: | :---: | :---: |
| Read document | Yes | Yes | Yes | `401` / `403` |
| Rename & edit content | Yes | Yes | `403` | `401` / `403` |
| View/manage shares & public link | Yes | `403` | `403` | `401` / `403` |
| Delete document | Yes | `403` | `403` | `401` / `403` |

1. **Identity & Input Validation**:
   - Every Route Handler resolves identity exclusively from `supabase.auth.getUser()`.
   - Mutation Zod schemas use `.strict()` (`src/lib/validations/*.ts`), rejecting unexpected client-supplied fields like `ownerId`, `userId`, or `createdBy` with HTTP `400`.
2. **Service-Layer Authorization (`src/services/authorization.ts`)**:
   - `resolveDocumentRole()` computes the effective role (`owner` > `editor` > `viewer` > `null`).
   - `assertDocumentAction()` throws `AuthorizationError(401 | 403 | 404)` before any database read/write completes.
3. **Database Row Level Security (`supabase/migrations/001_initial_schema.sql`)**:
   - `SECURITY DEFINER` helpers (`is_document_owner`, `has_document_access`) enforce identical rules inside PostgreSQL without RLS self-recursion.

---

## 6. Autosave Design

Implemented in [`src/components/editor/document-workspace.tsx`](src/components/editor/document-workspace.tsx):

- **800ms Debounce**: Title and editor updates schedule a single `800ms` (`AUTOSAVE_DEBOUNCE_MS`) timer before dispatching `PATCH /api/documents/[id]`.
- **Snapshot Deduplication**: Normalized JSON snapshots (`{ title, content }`) are compared against `lastSavedSnapshotRef` and `inFlightSnapshotRef`. Reverting an edit before the timer fires, clicking Save when already synced, or non-structural editor events do **not** send database requests.
- **Sequential Trailing Flush**: If the user keeps typing while a `PATCH` request is in flight, `pendingFlushRef` triggers a clean `while` loop flush once the active request finishes so no edits are dropped and no out-of-order writes race.
- **Failure Recovery & Navigation Guard**:
  - Surfaces clear states: `Saving...`, `Saved`, `Unsaved changes`, `Save failed` (with an inline **Retry** action), and `Read-only`.
  - Registers a `beforeunload` warning when unsaved changes exist.
  - Clicking **Back to dashboard** flushes pending changes first and keeps the user on the editor if saving fails.
  - Unmounting with remaining unsaved changes dispatches a `keepalive: true` `PATCH` request.

---

## 7. Important Tradeoffs

1. **Tiptap JSONB vs. Markdown Storage**: Storing ProseMirror JSON in `jsonb` preserves exact editor marks (underline, highlight, nested task lists) without lossy Markdown round-trip conversions, at the cost of maintaining a derived `content_text` column for search/previews.
2. **Debounced REST Saves vs. Real-Time CRDTs (Yjs/WebSockets)**: Debounced HTTP `PATCH` autosave keeps the MVP stateless on Vercel Serverless Functions without running a dedicated WebSocket/Hocuspocus server; adding live multi-cursor co-editing later would layer Yjs over Supabase Realtime or a WebSocket provider.
3. **Dual TypeScript + PostgreSQL RLS Authorization vs. RLS-Only**: Checking roles explicitly in `authorization.ts` produces structured `401`/`403`/`404` API errors and unit-testable policies, while PostgreSQL RLS protects the database even if a route handler has a bug. The tradeoff is keeping both policy definitions aligned.
4. **Custom Zero-DOM Markdown Parser vs. Third-Party HTML/DOM Parsers**: `import-parser.ts` converts Markdown directly into validated Tiptap JSON nodes without `innerHTML` or DOM dependencies, eliminating XSS surfaces and simplifying server-side execution/testing, while scoping support to common Markdown constructs (excluding complex GFM tables/footnotes in v1).
5. **System Font Stack vs. `next/font/google`**: Using a clean system sans/mono stack avoids build-time network requests to `fonts.googleapis.com`, making `next build` deterministic in offline/CI sandboxes.
6. **Stateful In-Memory Supabase Test Double**: Automated tests run deterministically offline against a query-builder double and mocked SSR client rather than requiring a live remote PostgreSQL instance during `npm test`.

