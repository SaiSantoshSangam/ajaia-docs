# Ajaia Docs

**Ajaia Docs** is a collaborative SaaS document workspace built for the Ajaia LLC AI-Native Full Stack Developer assignment. Users can create rich documents, import `.txt` and `.md` files, edit with a Tiptap rich-text editor with 800ms debounced autosave, and share documents securely with collaborator roles (`Viewer` / `Editor`) or public share links backed by Supabase PostgreSQL and server-side authorization.

---

## Technology Stack

- **Framework**: Next.js `16.4.6` (App Router, Turbopack, Cache Components, `src/proxy.ts`)
- **UI & Language**: React `19.3.0`, TypeScript `5` (strict mode)
- **Styling & Components**: Tailwind CSS `4`, shadcn/ui-style Radix UI primitives, Lucide React, Sonner
- **Rich Text Editor**: Tiptap `3.35.0` (`StarterKit`, `Underline`, `Highlight`, `Link`, `TaskList`, `TaskItem`, `Placeholder`)
- **Database & Auth**: Supabase PostgreSQL (`@supabase/supabase-js`, `@supabase/ssr`) with Row Level Security (RLS)
- **Validation**: Zod `4` (strict schemas rejecting unexpected client fields)
- **Testing**: Vitest `5`, React Testing Library, `jsdom`

---

## Prerequisites

- **Node.js**: v20+ (developed and verified on Node `v22.23.5` and `npm 10.9.9`)
- **npm**: v10+
- **Supabase Project**: A hosted project at [supabase.com](https://supabase.com) or local Supabase CLI instance

---

## Installation

```bash
git clone <your-repo-url>
cd ajaia
npm install
```

---

## Environment Configuration

Copy `.env.example` to `.env.local` and fill in your Supabase project values:

```bash
cp .env.example .env.local
```

Required and optional environment variables:

| Variable | Required | Exposure | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Your Supabase `anon` public key |
| `DEMO_USER_PASSWORD` | Optional | Server-only | Password used by `/api/auth/demo-switch` (defaults to `AjaiaDemo123!`) |
| `NEXT_PUBLIC_APP_URL` | Optional | Public | Canonical app URL (defaults to Vercel URL or `http://localhost:3000`) |

> **Security Note**: Never commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY`. All server authorization is enforced via authenticated user sessions (`supabase.auth.getUser()`) and PostgreSQL RLS.

---

## Supabase Setup & Database Migrations

1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. In **Project Settings -> API**, copy your **Project URL** and **anon public key** into `.env.local`.
3. In **Authentication -> URL Configuration**:
   - Set **Site URL** to `http://localhost:3000` (or your Vercel production URL).
   - Add `http://localhost:3000/auth/callback` (and `https://<your-domain>/auth/callback`) to **Redirect URLs**.
4. Apply the database schema migration in the **Supabase SQL Editor** (or via Supabase CLI):
   - Run [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) to create:
     - `public.users` (synced with `auth.users` via `handle_new_user()`)
     - `public.documents` (Tiptap JSONB content, `content_text`, UUIDs, sharing metadata, timestamps)
     - `public.document_shares` (`viewer` / `editor` collaborator roles, UUIDs, timestamps)
     - `updated_at` triggers, `SECURITY DEFINER` access helpers, and Row Level Security policies.
5. Seed the 3 demo accounts and starter documents by running [`supabase/seed.sql`](supabase/seed.sql) in the **Supabase SQL Editor**.

---

## Running Locally & Testing

### Local Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Verification Commands
```bash
# Run all Vitest unit, service, API, and component tests (9 files, 37 tests)
npm test

# Watch mode during development
npm run test:watch

# Strict TypeScript type-checking
npm run typecheck

# ESLint check
npm run lint

# Production Next.js build
npm run build
```

---

## Demo Credentials

After applying `supabase/seed.sql`, you can sign in manually on `/login` or use the one-click **Demo User Switcher** (on `/login` and in the dashboard sidebar):

| Name | Email | Password | Seeded Access Overview |
| :--- | :--- | :--- | :--- |
| **Alice Morgan** | `alice@ajaia.demo` | `AjaiaDemo123!` | Owns *Architecture Overview* & *Product Launch Checklist*; Viewer on Bob's notes |
| **Bob Chen** | `bob@ajaia.demo` | `AjaiaDemo123!` | Editor on Alice's *Architecture Overview*; Owns *Q4 Engineering Sprint Notes* |
| **Carol Davis** | `carol@ajaia.demo` | `AjaiaDemo123!` | Viewer on Alice's *Architecture Overview*; Owns *Carol Private Research Notes* |

---

## Supported File Types (Document Import)

From the dashboard **Import File** modal (`src/components/dashboard/import-dialog.tsx`) or `POST /api/documents/import`:

- **Extensions**: `.txt`, `.md`, `.markdown`
- **Maximum File Size**: `2 MB` (`2,097,152` bytes)
- **Validation**: Rejects unsupported extensions, empty or whitespace-only files, oversized files, and files containing binary null bytes (`\u0000`).
- **Conversion**:
  - `.txt`: Converts blank-line-separated blocks into Tiptap paragraphs while preserving single line breaks as `hardBreak` nodes.
  - `.md` / `.markdown`: Parses ATX headings (`#`–`######`), bold, italic, strikethrough, inline code, safe `http(s)`/`mailto` links, bullet lists, numbered lists, task lists (`- [ ]` / `- [x]`), blockquotes, horizontal rules, and fenced code blocks into Tiptap JSON, auto-detecting the document title from the first H1 heading or filename.

---

## Production Deployment (Vercel + Supabase)

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the complete deployment guide and verification checklist:

1. Apply `supabase/migrations/001_initial_schema.sql` and `supabase/seed.sql` on your production Supabase project.
2. Deploy to Vercel (`vercel --prod` or Git integration) with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DEMO_USER_PASSWORD` configured in Vercel Project Settings.
3. Verify `GET https://<your-domain>/api/health` returns `{ "status": "ok", "supabaseConfigured": true, "database": "connected" }`, then test document creation, editing, refresh persistence, TXT/MD import, and Viewer/Editor sharing permissions.
